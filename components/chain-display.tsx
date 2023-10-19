import React, { useState, useEffect } from 'react';

import { Form, Container, Message, Table, Loader } from 'semantic-ui-react';
import { subProvider } from '../web3/api';
import { containerProvider } from '../web3/containerAPI';

import _ from 'underscore';

const ChainInfoComponent = ({ network }) => {
  const [paraIDs, setParaIDs] = useState(Array());
  const [chainData, setChainData] = useState([]);
  const [timeNow, setTimeNow] = useState(BigInt(0));
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initial data load
    loadAllData();

    // Load data every 3 seconds
    const timer = setInterval(loadAllData, 3000);

    return () => {
      // Clean up the timer when the component unmounts
      clearInterval(timer);
    };
  }, [network]);

  const loadAllData = async () => {
    setErrorMessage('');

    try {
      // Load Provider
      const api = await subProvider(network);

      // Get all actives ParachainID
      const containerChains = (await api.query.collatorAssignment.collatorContainerChain()).toHuman().containerChains;
      const paraIDs = Object.keys(containerChains).map(Number);
      setParaIDs(paraIDs);

      // Set Timestamp
      setTimeNow(BigInt(Date.now()));

      // Chain Data
      const data = await fetchChainData(paraIDs);
      console.log(data);
      if (data) {
        setChainData(data);
      } else {
        setErrorMessage('Error fetching chain data');
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const fetchChainData = async (paraIDs) => {
    try {
      // Check if Parachain IDs were obtained
      if (paraIDs) {
        // Parallelized queries
        const promises = paraIDs.map(async (paraID) => {
          // Get ContainerChain URL
          const paraURL = `wss://fraa-dancebox-${paraID}-rpc.a.dancebox.tanssi.network`;

          // Create Container Provider
          const api = await containerProvider(paraURL);

          // Get Params
          const [healthy, properties, blockHash, blockNumber, timestamp] = await Promise.all([
            api.rpc.system.health(),
            api.rpc.system.properties(),
            api.rpc.chain.getBlockHash(),
            api.rpc.chain.getBlock(await api.rpc.chain.getBlockHash()),
            api.query.timestamp.now(),
          ]);

          return {
            paraID,
            healthy,
            properties,
            blockHash,
            blockNumber,
            timestamp,
          };
        });

        // Use Promise.all to await all promises concurrently
        return await Promise.all(promises);
      } else {
        return null;
      }
    } catch (err) {
      setErrorMessage(err.message);
      return null;
    }
  };

  const renderData = () => {
    if (chainData && chainData.length > 0) {
      return (
        <div>
          <Table singleLine color='teal' textAlign='center'>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Para ID</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>is EVM?</Table.HeaderCell>
                <Table.HeaderCell>Last Block</Table.HeaderCell>
                <Table.HeaderCell>Block Number</Table.HeaderCell>
                <Table.HeaderCell>Block Hash</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {chainData.map((item, index) => (
                <Table.Row key={index}>
                  <Table.Cell>
                    <a
                      href={`https://polkadot.js.org/apps/?rpc=wss://fraa-dancebox-${item.paraID}-rpc.a.dancebox.tanssi.network`}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {item.paraID}
                    </a>
                  </Table.Cell>
                  <Table.Cell>{item.healthy.peers >= 1 ? '✔️' : '❌'}</Table.Cell>
                  <Table.Cell>{item.properties.isEthereum ? '✔️' : '❌'}</Table.Cell>
                  <Table.Cell>
                    {`${(
                      (BigInt(Date.now()) - BigInt(item.timestamp.toString())) / BigInt(1000) -
                      BigInt(12)
                    ).toString()}s ago`}
                  </Table.Cell>
                  <Table.Cell>{item.blockNumber.block.header.number.toString()}</Table.Cell>
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
