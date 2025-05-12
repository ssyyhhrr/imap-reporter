<a name="readme-top"></a>
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<h3 align="center">imap-reporter</h3>

  <p align="center">
    A lightweight Express.js API for checking IMAP mailbox usage and quota information, initially designed for use with <a href="https://github.com/glanceapp/glance">Glance</a>.
    <br />
    <br />
    <a href="https://github.com/ssyyhhrr/rclone-reporter/issues">Report Bug</a>
    ·
    <a href="https://github.com/ssyyhhrr/rclone-reporter/issues">Request Feature</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
    </li>
    <li><a href="#prerequisites">Prerequisites</a></li>
    <li><a href="#installation">Installation</a></li>
    <li><a href="#environment-configuration">Environment Configuration</a></li>
    <li><a href="#api-endpoints">API Endpoints</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#deployment-considerations">Deployment Considerations</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#troubleshooting">Troubleshooting</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

<ul>
    <li>Check IMAP mailbox storage usage and quota information</li>
    <li>Automatic fallback to manual size calculation when quota unavailable</li>
    <li>Support for single account and batch operations</li>
    <li>Multiple IMAP server format compatibility</li>
    <li>RESTful API with comprehensive error handling</li>
    <li>Support for environment variable configuration</li>
    <li>TLS/SSL secure connections</li>
</ul>

## Prerequisites
<ul>
    <li>Node.js (v14 or higher)</li>
    <li>npm or yarn</li>
    <li>IMAP account credentials</li>
    <li>Access to IMAP server configuration details</li>
</ul>

## Installation
1. Clone this repository:
```
git clone https://github.com/ssyyhhrr/imap-reporter.git
cd imap-reporter
```

2. Install dependencies:
```
npm install
```

3. Configure environment variables (see below)

4. Start the server:
```
npm start
```

## Environment Configuration
Create a `.env` file in the root directory with the following variables:
```
PORT=3000
IMAP_USER=your-email@example.com
IMAP_PASSWORD=your-password
IMAP_HOST=imap.example.com
IMAP_PORT=993
```

## API Endpoints

### Health Check
```
GET /health
```
Returns the service status.

Example Response:
```json
{
  "status": "ok",
  "timestamp": "2024-03-10T12:00:00.000Z"
}
```

### Check Default Mailbox
```
GET /mailbox
```

Uses environment variables for configuration. Returns mailbox usage information.

Example Response (Quota Available):
```json
{
  "success": true,
  "type": "quota",
  "data": {
    "usedMB": 1234.56,
    "limitMB": 5120.00,
    "percentUsed": 24.11,
    "availableMB": 3885.44
  }
}
```

Example Response (Manual Calculation):
```json
{
  "success": true,
  "type": "manual",
  "data": {
    "totalSizeMB": 1234.56,
    "messageCount": 1523,
    "note": "Size limit not available via IMAP"
  }
}
```

### Check Custom Mailbox
```
POST /mailbox
```

Body:
```json
{
  "user": "user@example.com",
  "password": "password123",
  "host": "imap.example.com",
  "port": 993
}
```

Example Response:
```json
{
  "success": true,
  "type": "quota",
  "data": {
    "usedMB": 2345.67,
    "limitMB": 10240.00,
    "percentUsed": 22.91,
    "availableMB": 7894.33
  }
}
```

### Batch Check Multiple Mailboxes

```
POST /mailbox/batch
```

Body:
```json
{
  "accounts": [
    {
      "user": "user1@example.com",
      "password": "password1",
      "host": "imap.example.com",
      "port": 993
    },
    {
      "user": "user2@example.com",
      "password": "password2",
      "host": "imap.gmail.com",
      "port": 993
    }
  ]
}
```

Example Response:
```json
{
  "results": [
    {
      "account": "user1@example.com",
      "success": true,
      "type": "quota",
      "data": {
        "usedMB": 1024.00,
        "limitMB": 5120.00,
        "percentUsed": 20.00,
        "availableMB": 4096.00
      }
    },
    {
      "account": "user2@example.com",
      "success": true,
      "type": "manual",
      "data": {
        "totalSizeMB": 3456.78,
        "messageCount": 5432,
        "note": "Size limit not available via IMAP"
      }
    }
  ]
}
```

<!-- USAGE EXAMPLES -->
## Usage

### Using cURL
```bash
# Check default mailbox
curl http://localhost:3000/mailbox

# Check custom mailbox
curl -X POST http://localhost:3000/mailbox \
  -H "Content-Type: application/json" \
  -d '{
    "user": "user@example.com",
    "password": "password123",
    "host": "imap.example.com"
  }'

# Check multiple mailboxes
curl -X POST http://localhost:3000/mailbox/batch \
  -H "Content-Type: application/json" \
  -d '{
    "accounts": [
      {
        "user": "user1@example.com",
        "password": "password1",
        "host": "imap.example.com"
      },
      {
        "user": "user2@example.com",
        "password": "password2",
        "host": "imap.gmail.com"
      }
    ]
  }'
```

### Using JavaScript/Fetch
```js
// Check mailbox with custom credentials
fetch('http://localhost:3000/mailbox', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        user: 'user@example.com',
        password: 'password123',
        host: 'imap.example.com'
    }),
})
    .then(response => response.json())
    .then(data => console.log(data));

// Check multiple accounts
fetch('http://localhost:3000/mailbox/batch', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        accounts: [
            {
                user: 'user1@example.com',
                password: 'password1',
                host: 'imap.example.com'
            },
            {
                user: 'user2@example.com',
                password: 'password2',
                host: 'imap.gmail.com'
            }
        ]
    }),
})
    .then(response => response.json())
    .then(data => console.log(data));
```

## Deployment Considerations
1. Store sensitive credentials securely using environment variables
2. Implement rate limiting for production deployment
3. Add authentication layer for API access control
4. Use HTTPS in production environments
5. Consider connection pooling for high-volume usage
6. Monitor IMAP connection limits imposed by email providers

## Contributing
If you have a suggestion that would make this project better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement". Don't forget to give the project a star! Thanks again!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

## Troubleshooting

### Common Issues
1. **"IMAP configuration not set":** Ensure environment variables are properly configured or provide credentials in the POST request.
2. **Connection errors:** Verify IMAP server host, port, and that TLS is properly configured.
3. **Quota information unavailable:** Some IMAP servers don't support quota extensions. The API will fallback to manual size calculation.
4. **Timeout errors:** Large mailboxes may take time to calculate. Consider implementing connection timeout adjustments.
5. **TLS certificate errors:** The API uses `rejectUnauthorized: false` by default. For production, configure proper certificate validation.

<!-- CONTACT -->
## Contact

Rhys Bishop - [https://sy.hr/](https://sy.hr/) - mail@rhysbi.shop

Project Link: [https://github.com/ssyyhhrr/imap-reporter](https://github.com/ssyyhhrr/ga4-reporter)

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/ssyyhhrr/imap-reporter.svg?style=for-the-badge
[contributors-url]: https://github.com/ssyyhhrr/imap-reporter/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/ssyyhhrr/imap-reporter.svg?style=for-the-badge
[forks-url]: https://github.com/ssyyhhrr/imap-reporter/network/members
[stars-shield]: https://img.shields.io/github/stars/ssyyhhrr/imap-reporter.svg?style=for-the-badge
[stars-url]: https://github.com/ssyyhhrr/imap-reporter/stargazers
[issues-shield]: https://img.shields.io/github/issues/ssyyhhrr/imap-reporter.svg?style=for-the-badge
[issues-url]: https://github.com/ssyyhhrr/imap-reporter/issues
[license-shield]: https://img.shields.io/github/license/ssyyhhrr/imap-reporter.svg?style=for-the-badge
[license-url]: https://github.com/ssyyhhrr/imap-reporter/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://www.linkedin.com/in/rhys-bishop-158638214/
