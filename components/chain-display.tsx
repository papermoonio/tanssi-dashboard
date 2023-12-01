import React, { useState, useEffect, useRef } from 'react';

import { Form, Container, Message, Table, Loader } from 'semantic-ui-react';
import { subProvider } from '../web3/api';

const ChainInfoComponent = ({ network }) => {
  const [chainData, setChainData] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const isInitialLoad = useRef(true);

  useEffect(() => {
    // First Load
    loadAllData(network);

    // Load data every 4 seconds
    const timer = setInterval(() => {
      loadAllData(network);
    }, 6000);

    return () => {
      // Clean up the timer when the component unmounts
      clearInterval(timer);
    };
  }, [network]);

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

      paraIDs = [Number(tanssiID)].concat(Object.keys(containerChains.toHuman().containerChains).map(Number));

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
      }

      // Chain Data
      const data = await fetchChainData(paraIDs.sort());
      if (data) {
        setChainData(data);
      } else {
        setErrorMessage('Error fetching chain data');
      }

      // Mark Loading as Finished
      isInitialLoad.current = false;
    } catch (err) {
      setErrorMessage(err.message);
    }

    setLoading(false);
  };

  const fetchChainData = async (paraIDs) => {
    try {
      // Check if Parachain IDs were obtained
      if (!paraIDs || paraIDs.length === 0) {
        return null;
      }

      // Create an array to store API instances
      const apiInstances = [];

      // Parallel APIs to optimize query speed
      for (const paraID of paraIDs) {
        let paraURL;
        let chainType;
        let label;

        // Fetch depend on Dancebox or ContainerChain
        if (paraID === 1000 && network === 'dancebox') {
          paraURL = `wss://fraa-flashbox-rpc.a.stagenet.tanssi.network`;

          chainType = 'orchestrator';
          label = 'Flashbox';
        } else if (paraID === 3000 && network === 'dancebox') {
          paraURL = `wss://fraa-dancebox-rpc.a.dancebox.tanssi.network`;

          chainType = 'orchestrator';
          label = 'Dancebox';
        } else if (paraID > 3000 && network === 'dancebox') {
          paraURL = `wss://fraa-dancebox-${paraID}-rpc.a.dancebox.tanssi.network`;

          chainType = 'appchain';
          label = '';
        } else if (paraID > 2000 && network === 'dancebox') {
          paraURL = `wss://fraa-flashbox-${paraID}-rpc.a.stagenet.tanssi.network`;

          chainType = 'appchain';
          label = 'Snapchain';
        }

        // Create Container Provider and store the API instance
        const api = await subProvider(paraURL);

        apiInstances.push({ api, paraID, paraURL, chainType, label });
      }

      // Fetch data in Parallel
      const dataPromises = apiInstances.map(async ({ api, paraID, paraURL, chainType, label }) => {
        const [properties, nCollators, timestamp, blockNumber, blockHash] = await Promise.all([
          api.rpc.system.properties(),
          chainType === 'orchestrator'
            ? api.query.collatorAssignment.collatorContainerChain()
            : api.query.authoritiesNoting.authorities(),
          api.query.timestamp.now(),
          api.rpc.chain.getBlock(await api.rpc.chain.getBlockHash()),
          api.rpc.chain.getBlockHash(),
        ]);

        // Get ChainID if it is an EVM Chain
        const ethChainId = properties.isEthereum ? (await api.rpc.eth.chainId()).toString().replaceAll(',', '') : null;

        await api.disconnect();

        return {
          paraURL,
          paraID,
          chainType,
          properties,
          nCollators,
          timestamp,
          blockNumber,
          blockHash,
          ethChainId,
          label,
        };
      });

      // Wait for all data promises to resolve
      const data = await Promise.all(dataPromises);

      return data;
    } catch (err) {
      setErrorMessage(err.message);
      return null;
    }
  };

  const renderData = () => {
    if (chainData && chainData.length > 0) {
      return (
        <div>
          <Table fixed singleLine color='teal' textAlign='center'>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell style={{ width: '100px' }}>Appchain ID</Table.HeaderCell>
                <Table.HeaderCell style={{ width: '150px' }}>Type</Table.HeaderCell>
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
              {chainData.map((item, index) => (
                <Table.Row key={index}>
                  <Table.Cell>
                    <a
                      href={`https://polkadot.js.org/apps/?rpc=${item.paraURL}`}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {item.paraID}
                    </a>
                  </Table.Cell>
                  <Table.Cell style={{ minWidth: '200px' }}>
                    {item.properties.isEthereum ? `EVM ${item.label}` : `Substrate ${item.label}`}
                  </Table.Cell>
                  <Table.Cell>
                    {item.properties.isEthereum ? (
                      <a
                        href={`https://tanssi-evmexplorer.netlify.app/?rpcUrl=${item.paraURL.replaceAll(
                          'wss',
                          'https'
                        )}`}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        {item.ethChainId}
                      </a>
                    ) : (
                      '--'
                    )}
                  </Table.Cell>
                  <Table.Cell>{item.properties.tokenSymbol.toHuman()}</Table.Cell>
                  <Table.Cell>{item.properties.tokenDecimals.toHuman()}</Table.Cell>
                  <Table.Cell>
                    {item.chainType === 'orchestrator'
                      ? item.nCollators.orchestratorChain.length.toString()
                      : item.nCollators.length.toString()}
                  </Table.Cell>
                  <Table.Cell>{`${Math.floor((Date.now() - item.timestamp.toNumber()) / 1000 - 12)}s ago`}</Table.Cell>
                  <Table.Cell>
                    {item.properties.isEthereum ? (
                      <a
                        href={`https://tanssi-evmexplorer.netlify.app/block/${item.blockNumber.block.header.number.toString()}?rpcUrl=${item.paraURL.replaceAll(
                          'wss',
                          'https'
                        )}`}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        {item.blockNumber.block.header.number.toString()}
                      </a>
                    ) : (
                      <a
                        href={`https://polkadot.js.org/apps/?rpc=${
                          item.paraURL
                        }/#/explorer/query/${item.blockNumber.block.header.number.toString()}`}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        {item.blockNumber.block.header.number.toString()}
                      </a>
                    )}
                  </Table.Cell>
                  <Table.Cell textAlign='left'>{item.blockHash.toString()}</Table.Cell>
                </Table.Row>
              ))}
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
        <h2>Tanssi {network.charAt(0).toUpperCase() + network.slice(1)} Dashboard</h2>
        {loading === true && <Loader active inline='centered' content='Loading' />}
        {loading === false && <Container>{renderData()}</Container>}

        <Message error header='Oops!' content={errorMessage} />
      </Form>
    </div>
  );
};

export default ChainInfoComponent;
