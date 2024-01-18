import React, { useState, useEffect, useRef } from 'react';
import { Form, Container, Message, Table, Loader } from 'semantic-ui-react';
import { subProvider } from '../web3/api';
import Link from 'next/link';

const ChainInfoComponent = ({ network }) => {
  const [loadedParaIDs, setLoadedParaIDs] = useState({});
  const [paraIDs, setParaIDs] = useState([]);
  const [isParaIDsLoaded, setIsParaIDsLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const isInitialLoad = useRef(true);

  useEffect(() => {
    // First Load
    loadAllData(network);

    // Load data for each paraID every in intervals
    let timer;

    const fetchDataInterval = async () => {
      for (const paraID of paraIDs) {
        await fetchChainData([paraID]);
      }
    };

    // Start the interval only when paraIDs is fully loaded
    if (isParaIDsLoaded) {
      timer = setInterval(fetchDataInterval, 6000);
    }

    return () => {
      // Clean up the timer when the component unmounts
      clearInterval(timer);
    };
  }, [network, isParaIDsLoaded]);

  const loadAllData = async (network) => {
    setErrorMessage('');

    // Load Spinner First Time
    if (isInitialLoad.current) {
      setLoading(true);
    }

    try {
      let paraIDs;

      // Load Provider
      const api = await subProvider(network);

      // Get Tanssi Para ID and Actives Parachain IDs
      const [tanssiID, containerChains] = await Promise.all([
        api.query.parachainInfo.parachainId(),
        api.query.collatorAssignment.collatorContainerChain(),
      ]);

      await api.disconnect();

      paraIDs = [Number(tanssiID)].concat(
        Object.keys(containerChains.toHuman().containerChains).map(Number)
      );

      // If Dancebox, we need to account Flashbox also
      if (network === 'dancebox') {
        // Load Provider
        const api = await subProvider('flashbox');

        // Get Tanssi Para ID and Actives Parachain IDs
        const [tanssiID, containerChains] = await Promise.all([
          api.query.parachainInfo.parachainId(),
          api.query.collatorAssignment.collatorContainerChain(),
        ]);

        paraIDs = paraIDs.concat(
          Number(tanssiID),
          ...Object.keys(containerChains.toHuman().containerChains).map(Number)
        );

        await api.disconnect();
      }

      setParaIDs(paraIDs);
      setIsParaIDsLoaded(true);

      setLoading(false);

      // Chain Data
      fetchChainData(paraIDs.sort());

      // Mark Loading as Finished
      isInitialLoad.current = false;
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const fetchChainData = async (paraIDs) => {
    try {
      // Check if Parachain IDs were obtained
      if (!paraIDs || paraIDs.length === 0) {
        return null;
      }

      // Parallel APIs to optimize query speed
      for (const paraID of paraIDs) {
        let paraURL;
        let chainType;
        let label;

        // Fetch depend on Dancebox or ContainerChain
        if (paraID === 1000 && network === 'dancebox') {
          paraURL = `wss://fraa-flashbox-rpc.a.stagenet.tanssi.network`;
          chainType = 'orchestrator';
          label = '';
        } else if (paraID === 3000 && network === 'dancebox') {
          paraURL = `wss://fraa-dancebox-rpc.a.dancebox.tanssi.network`;
          chainType = 'orchestrator';
          label = '';
        } else if (paraID > 3000 && network === 'dancebox') {
          paraURL = `wss://fraa-dancebox-${paraID}-rpc.a.dancebox.tanssi.network`;
          chainType = 'appchain';
          label = '';
        } else if (paraID > 2000 && network === 'dancebox') {
          paraURL = `wss://fraa-flashbox-${paraID}-rpc.a.stagenet.tanssi.network`;
          chainType = 'appchain';
          label = 'Snap';
        }

        // Create Container Provider and store the API instance
        const api = await subProvider(paraURL);

        const [properties, nCollators, timestamp, blockNumber, blockHash] =
          await Promise.all([
            api.rpc.system.properties(),
            chainType === 'orchestrator'
              ? api.query.collatorAssignment.collatorContainerChain()
              : api.query.authoritiesNoting.authorities(),
            api.query.timestamp.now(),
            api.rpc.chain.getBlock(await api.rpc.chain.getBlockHash()),
            api.rpc.chain.getBlockHash(),
          ]);

        // Get ChainID if it is an EVM Chain
        const ethChainId = properties.isEthereum.toHuman()
          ? (await api.rpc.eth.chainId()).toString().replaceAll(',', '')
          : null;

        await api.disconnect();

        setLoadedParaIDs((prevLoadedParaIDs) => ({
          ...prevLoadedParaIDs,
          [paraID]: {
            paraURL,
            chainType,
            properties,
            nCollators,
            timestamp,
            blockNumber,
            blockHash,
            ethChainId,
            label,
          },
        }));
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const renderData = () => {
    if (Object.keys(loadedParaIDs).length > 0) {
      return (
        <div>
          <Table fixed singleLine color='teal' textAlign='center'>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell style={{ width: '100px' }}>
                  Appchain ID
                </Table.HeaderCell>
                <Table.HeaderCell style={{ width: '150px' }}>
                  Type
                </Table.HeaderCell>
                <Table.HeaderCell>
                  EVM
                  <>
                    <br />
                  </>
                  Chain ID
                </Table.HeaderCell>
                <Table.HeaderCell>
                  Token
                  <>
                    <br />
                  </>
                  Symbol
                </Table.HeaderCell>
                <Table.HeaderCell>Decimals</Table.HeaderCell>
                <Table.HeaderCell># Collators</Table.HeaderCell>
                <Table.HeaderCell>Last Block</Table.HeaderCell>
                <Table.HeaderCell>
                  Lastest
                  <>
                    <br />
                  </>
                  Block
                </Table.HeaderCell>
                <Table.HeaderCell>Block Hash</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {paraIDs.map((paraID, index) => {
                if (!loadedParaIDs[paraID]) {
                  // If data for paraID is not yet loaded, you can render a placeholder or loading state
                  return (
                    <Table.Row key={index}>
                      <Table.Cell
                        colSpan={9}
                      >{`${paraID} Loading...`}</Table.Cell>
                    </Table.Row>
                  );
                }
                return (
                  <Table.Row key={index}>
                    <Table.Cell>
                      <Link
                        legacyBehavior
                        href={`https://polkadot.js.org/apps/?rpc=${loadedParaIDs[paraID].paraURL}`}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        {paraID}
                      </Link>
                    </Table.Cell>
                    <Table.Cell style={{ minWidth: '200px' }}>
                      {loadedParaIDs[paraID].properties.isEthereum.toHuman()
                        ? `EVM ${loadedParaIDs[paraID].label}`
                        : `Substrate ${loadedParaIDs[paraID].label}`}
                    </Table.Cell>
                    <Table.Cell>
                      {loadedParaIDs[paraID].properties.isEthereum.toHuman() ? (
                        <Link
                          legacyBehavior
                          href={`https://tanssi-evmexplorer.netlify.app/?rpcUrl=${loadedParaIDs[
                            paraID
                          ].paraURL.replaceAll('wss', 'https')}`}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          {loadedParaIDs[paraID].ethChainId}
                        </Link>
                      ) : (
                        '--'
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {loadedParaIDs[paraID].properties.tokenSymbol.toHuman()}
                    </Table.Cell>
                    <Table.Cell>
                      {loadedParaIDs[paraID].properties.tokenDecimals.toHuman()}
                    </Table.Cell>
                    <Table.Cell>
                      {loadedParaIDs[paraID].chainType === 'orchestrator'
                        ? loadedParaIDs[
                            paraID
                          ].nCollators.orchestratorChain.length.toString()
                        : loadedParaIDs[paraID].nCollators.length.toString()}
                    </Table.Cell>
                    <Table.Cell>{`${Math.floor(
                      (Date.now() -
                        loadedParaIDs[paraID].timestamp.toNumber()) /
                        1000 -
                        12
                    )}s ago`}</Table.Cell>
                    <Table.Cell>
                      {loadedParaIDs[paraID].properties.isEthereum.toHuman() ? (
                        <Link
                          legacyBehavior
                          href={`https://tanssi-evmexplorer.netlify.app/block/${loadedParaIDs[
                            paraID
                          ].blockNumber.block.header.number.toString()}?rpcUrl=${loadedParaIDs[
                            paraID
                          ].paraURL.replaceAll('wss', 'https')}`}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          {loadedParaIDs[
                            paraID
                          ].blockNumber.block.header.number.toString()}
                        </Link>
                      ) : (
                        <Link
                          legacyBehavior
                          href={`https://polkadot.js.org/apps/?rpc=${
                            loadedParaIDs[paraID].paraURL
                          }/#/explorer/query/${loadedParaIDs[
                            paraID
                          ].blockNumber.block.header.number.toString()}`}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          {loadedParaIDs[
                            paraID
                          ].blockNumber.block.header.number.toString()}
                        </Link>
                      )}
                    </Table.Cell>
                    <Table.Cell textAlign='left'>
                      {loadedParaIDs[paraID].blockHash.toString()}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      <Form error={!!errorMessage}>
        <h2>
          Tanssi {network.charAt(0).toUpperCase() + network.slice(1)} Dashboard
        </h2>
        {loading && <Loader active inline='centered' content='Loading' />}
        {!loading && <Container>{renderData()}</Container>}
        <Message error header='Oops!' content={errorMessage} />
      </Form>
    </div>
  );
};

export default ChainInfoComponent;
