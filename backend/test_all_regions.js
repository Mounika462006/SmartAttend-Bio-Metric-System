const { Client } = require('pg');

const regions = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2',
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2',
  'sa-east-1', 'ca-central-1', 'me-central-1', 'af-south-1'
];

async function testAll() {
  const password = 'Mounika@0406';
  const encodedPassword = encodeURIComponent(password);
  
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    // We try port 5432 first, as it's the standard port
    const connectionString = `postgres://postgres.hoijyrvvshbidnqrsqzk:${encodedPassword}@${host}:5432/postgres`;
    
    console.log(`[Test] Region: ${region} (${host}) on port 5432...`);
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000
    });
    
    try {
      await client.connect();
      console.log(`\n🎉 FOUND IT! Region is: ${region}`);
      await client.end();
      return region;
    } catch (err) {
      if (err.message.includes('password authentication failed')) {
        console.log(`\n🎉 FOUND REGION (but password failed)! Region is: ${region}`);
        await client.end();
        return region;
      }
      console.log(`- Result: ${err.message}`);
      try { await client.end(); } catch(e){}
    }
  }
  
  console.log('\n❌ Done testing all regions. None succeeded.');
  return null;
}

testAll();
