import pkg from 'pg';
const { Client } = pkg;

const regions = [
  'ap-south-1',     // Mumbai
  'ap-southeast-1', // Singapore
  'us-east-1',      // N. Virginia
  'us-east-2',      // Ohio
  'us-west-1',      // N. California
  'us-west-2',      // Oregon
  'eu-central-1',   // Frankfurt
  'eu-west-1',      // Ireland
  'eu-west-2'       // London
];

const password = 'Saran2026Neralla';
const projectRef = 'kfsosloiimtivunzicjq';

async function testConnection() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connectionString = `postgresql://postgres.${projectRef}:${password}@${host}:6543/postgres?pgbouncer=true`;
    
    console.log(`Testing connection to region: ${region} (${host})...`);
    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 4000,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`\n🎉 SUCCESS! Connected successfully to ${region} pooler!`);
      const res = await client.query('SELECT version();');
      console.log('Postgres Version:', res.rows[0].version);
      await client.end();
      console.log(`\nYour Vercel connection string is:\n${connectionString}\n`);
      process.exit(0);
    } catch (err) {
      console.log(`❌ Failed for ${region}: ${err.message}`);
    }
  }
  console.log('\nCould not connect to any of the tested regions.');
  process.exit(1);
}

testConnection();
