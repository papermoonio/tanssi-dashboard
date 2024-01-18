import React, { useState, useEffect } from 'react';
import { Container, Menu, Dropdown } from 'semantic-ui-react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ChainInfoComponent from '../components/chain-display';

const Networks = [
  {
    key: 'Dancebox',
    text: 'Dancebox',
    value: 'dancebox',
    image: { avatar: true, src: 'tanssi.png' },
  },
];

const TanssiDashboard = () => {
  const router = useRouter();

  // Set the Intial State of the Network based on Default Param or Route
  let defaultNetwork;
  const { network: networkQueryParam } = router.query;
  if (networkQueryParam) {
    defaultNetwork = router.query.network;
  } else {
    defaultNetwork = Networks[0].value;
  }
  const [network, setNetwork] = useState(defaultNetwork);

  useEffect(() => {
    if (router.query.network && network !== router.query.network) {
      setNetwork((router.query.network as string).toLocaleLowerCase());
    }
  }, [router.query.network]);

  const handleChange = (e, { value }) => {
    // Update the URL query param when the dropdown selection changes
    router.push(`/?network=${value}`);

    setNetwork(value);
  };

  return (
    <Container>
      <Head>
        <title>Tanssi Dashboard</title>
        <link rel='icon' type='image/png' sizes='32x32' href='/favicon.png' />
        <link
          rel='stylesheet'
          href='//cdn.jsdelivr.net/npm/semantic-ui@2.4.2/dist/semantic.min.css'
        />
      </Head>
      <div style={{ paddingTop: '10px' }}></div>
      <Menu>
        <Link legacyBehavior href='/'>
          <a className='item'>Tanssi Dashboard</a>
        </Link>
        <Menu.Item position='right'>
          <Dropdown
            placeholder='Select Network'
            selection
            options={Networks}
            onChange={handleChange}
            value={defaultNetwork}
          />
        </Menu.Item>
      </Menu>
      <br />
      {network ? (
        network == 'dancebox' ? (
          <ChainInfoComponent network={network} />
        ) : (
          <h3>Only Tanssi Dancebox is Supported</h3>
        )
      ) : (
        ''
      )}
      <br />
      <p>
        Don't judge the code :) as it is for demostration purposes only. You can
        check the source code &nbsp;
        <Link
          legacyBehavior
          href='https://github.com/papermoonio/tanssi-dashboard'
        >
          here
        </Link>
      </p>
      <br />
    </Container>
  );
};

export default TanssiDashboard;
