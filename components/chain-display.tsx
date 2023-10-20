import React, { useState, useEffect, useRef } from 'react';

import { Form, Container, Message, Table, Loader } from 'semantic-ui-react';
import { subProvider } from '../web3/api';

import _ from 'underscore';

const ChainInfoComponent = ({ network }) => {
  const [paraIDs, setParaIDs] = useState(Array());
  const [chainData, setChainData] = useState([]);
  const [timeNow, setTimeNow] = useState(BigInt(0));
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const isInitialLoad = useRef(true);

  useEffect(() => {
    // First Load
    loadAllData();

    // Load data every 4 seconds
    const timer = setInterval(loadAllData, 4000);

    return () => {
      // Clean up the timer when the component unmounts
      clearInterval(timer);
    };
  }, [network]);

  const loadAllData = async () => {
    setErrorMessage('');

    // Load Spinner First Time
    if (isInitialLoad.current) {
      setLoading(true);
    }

    try {
      // Load Provider
      const api = await subProvider(network);

      // Get all actives ParachainID
      const containerChains = (await api.query.collatorAssignment.collatorContainerChain()).toHuman().containerChains;
      const paraIDs = [0].concat(Object.keys(containerChains).map(Number));
      setParaIDs(paraIDs);

      // Set Timestamp
      setTimeNow(BigInt(Date.now()));

      // Chain Data
      const data = await fetchChainData(paraIDs);
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
        let collatorPallet;
        let collatorMethod;

        // Fetch depend on Dancebox or ContainerChain
        switch (paraID) {
          case 0:
            paraURL = `wss://fraa-dancebox-rpc.a.dancebox.tanssi.network`;
            collatorPallet = 'collatorAssignment';
            collatorMethod = 'collatorContainerChain';
            break;

          default:
            paraURL = `wss://fraa-dancebox-${paraID}-rpc.a.dancebox.tanssi.network`;
            collatorPallet = 'authoritiesNoting';
            collatorMethod = 'authorities';
            break;
        }

        // Create Container Provider and store the API instance
        const api = await subProvider(paraURL);

        apiInstances.push({ api, paraID, collatorPallet, collatorMethod });
      }

      // Fetch data in Parallel
      const dataPromises = apiInstances.map(async ({ api, paraID, collatorPallet, collatorMethod }) => {
        const [healthy, properties, nCollators, timestamp, blockNumber, blockHash] = await Promise.all([
          api.rpc.system.health(),
          api.rpc.system.properties(),
          api.query[collatorPallet][collatorMethod](),
          api.query.timestamp.now(),
          api.rpc.chain.getBlock(await api.rpc.chain.getBlockHash()),
          api.rpc.chain.getBlockHash(),
        ]);

        await api.disconnect();

        return {
          paraID,
          healthy,
          properties,
          nCollators,
          timestamp,
          blockNumber,
          blockHash,
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
          <Table size='small' fixed singleLine color='teal' textAlign='center'>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Para ID</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>is EVM?</Table.HeaderCell>
                <Table.HeaderCell>Token Symbol</Table.HeaderCell>
                <Table.HeaderCell>Decimals</Table.HeaderCell>
                <Table.HeaderCell># Collators</Table.HeaderCell>
                <Table.HeaderCell>Last Block</Table.HeaderCell>
                <Table.HeaderCell>
                  Block # <br /> Explorer
                </Table.HeaderCell>
                <Table.HeaderCell>Block Hash</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {chainData.map((item, index) => (
                <Table.Row key={index}>
                  <Table.Cell>
                    <a
                      href={
                        item.paraID === 0
                          ? 'https://polkadot.js.org/apps/?rpc=wss://fraa-dancebox-rpc.a.dancebox.tanssi.network#'
                          : `https://polkadot.js.org/apps/?rpc=wss://fraa-dancebox-${item.paraID}-rpc.a.dancebox.tanssi.network#`
                      }
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {item.paraID === 0 ? 'Dancebox' : item.paraID}
                    </a>
                  </Table.Cell>
                  <Table.Cell>{item.healthy.peers >= 1 ? '✔️' : '❌'}</Table.Cell>
                  <Table.Cell>{item.properties.isEthereum ? '✔️' : '❌'}</Table.Cell>
                  <Table.Cell>{item.properties.tokenSymbol.toHuman()}</Table.Cell>
                  <Table.Cell>{item.properties.tokenDecimals.toHuman()}</Table.Cell>
                  <Table.Cell>
                    {item.paraID === 0
                      ? item.nCollators.orchestratorChain.length.toString()
                      : item.nCollators.length.toString()}
                  </Table.Cell>
                  <Table.Cell>
                    {`${(
                      (BigInt(Date.now()) - BigInt(item.timestamp.toString())) / BigInt(1000) -
                      BigInt(12)
                    ).toString()}s ago`}
                  </Table.Cell>
                  <Table.Cell>
                    {item.blockNumber.block.header.number.toString()} <br />
                    <a
                      href={
                        item.paraID === 0
                          ? `https://polkadot.js.org/apps/?rpc=wss://fraa-dancebox-rpc.a.dancebox.tanssi.network#/explorer/query/${item.blockNumber.block.header.number.toString()}`
                          : `https://polkadot.js.org/apps/?rpc=wss://fraa-dancebox-${
                              item.paraID
                            }-rpc.a.dancebox.tanssi.network#/explorer/query/${item.blockNumber.block.header.number.toString()}`
                      }
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {'Substrate'}
                    </a>
                    {item.properties.isEthereum ? (
                      <span>
                        {' | '}
                        <a
                          href={`https://tanssi-evmexplorer.netlify.app/block/${item.blockNumber.block.header.number.toString()}/?rpcUrl=https://fraa-dancebox-${
                            item.paraID
                          }-rpc.a.dancebox.tanssi.network`}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          {'EVM'}
                        </a>
                      </span>
                    ) : (
                      ''
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
