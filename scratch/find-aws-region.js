import fs from 'fs';

// To do IP matching, we can convert IPv6 addresses to bigints
function ip6ToBigInt(ip) {
  // Remove brackets if any
  const cleanIp = ip.replace(/[\[\]]/g, '');
  const parts = cleanIp.split('::');
  
  let left = parts[0] ? parts[0].split(':') : [];
  let right = parts[1] ? parts[1].split(':') : [];
  
  const neededZeros = 8 - (left.length + right.length);
  const middle = Array(neededZeros).fill('0');
  
  const fullHex = [...left, ...middle, ...right].map(part => {
    if (part === '') return '0000';
    return part.padStart(4, '0');
  }).join('');

  return BigInt('0x' + fullHex);
}

// Check if an IPv6 falls within a CIDR prefix
function isIp6InCidr(ip, cidr) {
  const [prefix, maskStr] = cidr.split('/');
  const mask = parseInt(maskStr, 10);
  
  const ipBig = ip6ToBigInt(ip);
  const prefixBig = ip6ToBigInt(prefix);
  
  // Shift right to mask
  const shift = BigInt(128 - mask);
  return (ipBig >> shift) === (prefixBig >> shift);
}

async function findRegion() {
  const targetIp = '2406:da14:1772:ea00:417a:bfc9:58c5:f5ba';
  console.log(`Fetching AWS IP Ranges to locate ${targetIp}...`);
  
  try {
    const res = await fetch('https://ip-ranges.amazonaws.com/ip-ranges.json');
    const data = await res.json();
    
    console.log(`Searching through ${data.ipv6_prefixes.length} IPv6 prefixes...`);
    
    let match = null;
    for (const entry of data.ipv6_prefixes) {
      if (isIp6InCidr(targetIp, entry.ipv6_prefix)) {
        match = entry;
        break;
      }
    }
    
    if (match) {
      console.log('\n🎉 FOUND MATCH!');
      console.log('Prefix:', match.ipv6_prefix);
      console.log('Region:', match.region);
      console.log('Service:', match.service);
    } else {
      console.log('\n❌ No matching AWS prefix found.');
    }
  } catch (e) {
    console.error('Error fetching AWS IP ranges:', e);
  }
}

findRegion();
