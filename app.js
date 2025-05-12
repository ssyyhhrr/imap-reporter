const express = require('express');
const Imap = require('imap');
const util = require('util');

// Create Express app
const app = express();
app.use(express.json());

// Configuration - Can be overridden by environment variables
const defaultConfig = {
    imap: {
        user: process.env.IMAP_USER || 'your-email@example.com',
        password: process.env.IMAP_PASSWORD || 'your-password',
        host: process.env.IMAP_HOST || 'imap.example.com',
        port: process.env.IMAP_PORT || 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
    },
    server: {
        port: process.env.PORT || 3000
    }
};

class MailboxChecker {
    constructor(config) {
        this.imap = new Imap(config);
        this.connected = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.imap.once('ready', () => {
                this.connected = true;
                resolve();
            });

            this.imap.once('error', (err) => {
                reject(err);
            });

            this.imap.connect();
        });
    }

    disconnect() {
        if (this.connected) {
            this.imap.end();
            this.connected = false;
        }
    }

    getQuota() {
        return new Promise((resolve, reject) => {
            // Try to get quota root for INBOX
            this.imap.getQuotaRoot('INBOX', (err, quotaRoots) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Debug: Log the actual structure
                console.log('Quota response structure:', util.inspect(quotaRoots, { depth: null }));

                if (!quotaRoots) {
                    reject(new Error('No quota information available'));
                    return;
                }

                // Check various possible quota response formats
                try {
                    // Format 1: Direct object with quota property
                    if (quotaRoots.quota) {
                        const quota = quotaRoots.quota;
                        if (quota.STORAGE) {
                            const [used, limit] = quota.STORAGE;
                            resolve({
                                used: used,
                                limit: limit,
                                usedMB: parseFloat((used / 1024).toFixed(2)),
                                limitMB: parseFloat((limit / 1024).toFixed(2)),
                                percentUsed: parseFloat(((used / limit) * 100).toFixed(2))
                            });
                            return;
                        }
                    }

                    // Format 2: Object with named quota (like "User quota")
                    for (const key in quotaRoots) {
                        const quotaInfo = quotaRoots[key];

                        // Check for lowercase 'storage' (as in your server's response)
                        if (quotaInfo.storage) {
                            const { usage, limit } = quotaInfo.storage;
                            resolve({
                                used: usage,
                                limit: limit,
                                usedMB: parseFloat((usage / 1024).toFixed(2)),
                                limitMB: parseFloat((limit / 1024).toFixed(2)),
                                percentUsed: parseFloat(((usage / limit) * 100).toFixed(2))
                            });
                            return;
                        }

                        // Check for uppercase 'STORAGE'
                        if (quotaInfo.STORAGE) {
                            const [used, limit] = quotaInfo.STORAGE;
                            resolve({
                                used: used,
                                limit: limit,
                                usedMB: used / 1024,
                                limitMB: limit / 1024,
                                percentUsed: (used / limit) * 100
                            });
                            return;
                        }
                    }

                    // Format 3: Array of quota roots
                    if (Array.isArray(quotaRoots)) {
                        for (const root of quotaRoots) {
                            if (root.quota) {
                                if (root.quota.STORAGE) {
                                    const [used, limit] = root.quota.STORAGE;
                                    resolve({
                                        used: used,
                                        limit: limit,
                                        usedMB: used / 1024,
                                        limitMB: limit / 1024,
                                        percentUsed: (used / limit) * 100
                                    });
                                    return;
                                }
                                if (root.quota.storage) {
                                    const { usage, limit } = root.quota.storage;
                                    resolve({
                                        used: usage,
                                        limit: limit,
                                        usedMB: parseFloat((usage / 1024).toFixed(2)),
                                        limitMB: parseFloat((limit / 1024).toFixed(2)),
                                        percentUsed: parseFloat(((usage / limit) * 100).toFixed(2))
                                    });
                                    return;
                                }
                            }
                        }
                    }

                    reject(new Error('Storage quota not found in response'));
                } catch (parseError) {
                    reject(new Error(`Error parsing quota response: ${parseError.message}`));
                }
            });
        });
    }

    calculateSizeManually() {
        return new Promise((resolve, reject) => {
            this.imap.openBox('INBOX', true, (err, box) => {
                if (err) {
                    reject(err);
                    return;
                }

                let totalSize = 0;
                const messageCount = box.messages.total;

                if (messageCount === 0) {
                    resolve({ totalSize: 0, messageCount: 0 });
                    return;
                }

                // Fetch size information for all messages
                const fetch = this.imap.seq.fetch('1:*', {
                    envelope: false,
                    struct: false,
                    size: true
                });

                fetch.on('message', (msg, seqno) => {
                    msg.on('attributes', (attrs) => {
                        totalSize += attrs.size;
                    });
                });

                fetch.once('error', (err) => {
                    reject(err);
                });

                fetch.once('end', () => {
                    resolve({
                        totalSize,
                        totalSizeMB: parseFloat((totalSize / (1024 * 1024)).toFixed(2)),
                        messageCount
                    });
                });
            });
        });
    }

    async checkMailbox() {
        try {
            await this.connect();

            try {
                // Try to get quota information
                const quota = await this.getQuota();

                return {
                    success: true,
                    type: 'quota',
                    data: {
                        usedMB: quota.usedMB,
                        limitMB: quota.limitMB,
                        percentUsed: quota.percentUsed,
                        availableMB: parseFloat((quota.limitMB - quota.usedMB).toFixed(2))
                    }
                };

            } catch (quotaError) {
                console.log('Quota not available, calculating manually...');

                // Fallback to manual calculation
                const sizeInfo = await this.calculateSizeManually();

                return {
                    success: true,
                    type: 'manual',
                    data: {
                        totalSizeMB: sizeInfo.totalSizeMB,
                        messageCount: sizeInfo.messageCount,
                        note: 'Size limit not available via IMAP'
                    }
                };
            }

        } catch (error) {
            throw error;
        } finally {
            this.disconnect();
        }
    }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get mailbox info using default config
app.get('/mailbox', async (req, res) => {
    try {
        if (defaultConfig.imap.user === 'your-email@example.com') {
            return res.status(400).json({
                error: 'IMAP configuration not set',
                message: 'Please configure IMAP credentials via environment variables or POST request'
            });
        }

        const checker = new MailboxChecker(defaultConfig.imap);
        const result = await checker.checkMailbox();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get mailbox info with custom config
app.post('/mailbox', async (req, res) => {
    try {
        const { user, password, host, port = 993 } = req.body;

        if (!user || !password || !host) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['user', 'password', 'host']
            });
        }

        const customConfig = {
            user,
            password,
            host,
            port,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        };

        const checker = new MailboxChecker(customConfig);
        const result = await checker.checkMailbox();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get mailbox info for multiple accounts
app.post('/mailbox/batch', async (req, res) => {
    try {
        const { accounts } = req.body;

        if (!accounts || !Array.isArray(accounts)) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Expected { accounts: [...] }'
            });
        }

        const results = [];

        for (const account of accounts) {
            const { user, password, host, port = 993 } = account;

            if (!user || !password || !host) {
                results.push({
                    account: user || 'unknown',
                    success: false,
                    error: 'Missing required fields'
                });
                continue;
            }

            try {
                const customConfig = {
                    user,
                    password,
                    host,
                    port,
                    tls: true,
                    tlsOptions: { rejectUnauthorized: false }
                };

                const checker = new MailboxChecker(customConfig);
                const result = await checker.checkMailbox();
                results.push({
                    account: user,
                    ...result
                });
            } catch (error) {
                results.push({
                    account: user,
                    success: false,
                    error: error.message
                });
            }
        }

        res.json({ results });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        availableEndpoints: [
            'GET /health',
            'GET /mailbox',
            'POST /mailbox',
            'POST /mailbox/batch'
        ]
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
const port = defaultConfig.server.port;
app.listen(port, () => {
    console.log(`IMAP Mailbox API Server running on port ${port}`);
    console.log(`\nAvailable endpoints:`);
    console.log(`- GET  http://localhost:${port}/health`);
    console.log(`- GET  http://localhost:${port}/mailbox`);
    console.log(`- POST http://localhost:${port}/mailbox`);
    console.log(`- POST http://localhost:${port}/mailbox/batch`);

    if (defaultConfig.imap.user === 'your-email@example.com') {
        console.log('\n⚠️  Warning: Default IMAP configuration not set!');
        console.log('Please set environment variables or use POST endpoints with credentials.');
    }
});

module.exports = app;