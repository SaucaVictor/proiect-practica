import fetch from 'node-fetch';

const baseUrl = 'https://practica-devidevs-utcb-grupa-a-2.atlassian.net';
const email = 'tudor.constantin501@gmail.com';
const apiToken = 'ATATT3xFfGF0s9bEOUUvw16b6qdI7PnmbZ3ODJrio2XKGjO-IUfdF8qI5ZzaZVJ9d9QiPHmoVQOHHFLdtNFSY2kAX24KzvxlyrQTV6JYaJ8qieCtsZv0Ir88ixXvDbO5fM1L8yTnp_1Ul4TMkDcf22pVUIcCXLbw_y5vfYMUXayo2Y3yjcIOcTE=13E83B0F';
const issueKey = 'IOT-25';

const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

const response = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/worklog`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    timeSpent: '4h',
    comment: {
      type: 'doc',
      version: 1,
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Am implementat Light Mode sub formă de bază pentru aplicație și am reparat bug-urile pentru tab-ul IoT și Orar. Au apărut probleme la schimbarea temei (slider-ele devenau albe/invizibile în light mode), fixate prin adăugarea variabilei CSS --iot-slider-track pentru ambele teme.'
        }]
      }]
    }
  })
});

const data = await response.json();
console.log('Status:', response.status);
console.log('Response:', JSON.stringify(data, null, 2));
