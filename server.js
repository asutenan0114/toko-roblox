const express = require('express');
const midtransClient = require('midtrans-client');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Data Item Grow a Garden 2 Anda (DIKUNCI DENGAN TAG GAME YANG BENAR)
const ITEMS_DATABASE = {
    "item-001": { name: "Seed Defender", price: 8000, desc: "Venus Fly Trap seed.", image: "/Venus Fly Trap seed.png", game: "grow-a-garden-2" },
    "item-002": { name: "Fasting grow Fruit", price: 5000, desc: "Super Sprinkler.", image: "/Super Sprinkler.jpg", game: "grow-a-garden-2" },
    "item-003": { name: "Grow up Fruit", price: 5000, desc: "Super Water Can.", image: "/Super Water Can.jpg", game: "grow-a-garden-2" },
    "item-004": { name: "Seed Event", price: 3000, desc: "Rainbow Seed.", image: "/Rainbow Seed.jpg", game: "grow-a-garden-2" },
    "item-005": { name: "Pet", price: 15000, desc: "Unicorn.", image: "/pet-unicorn.png", game: "grow-a-garden-2" }
};

// Menggunakan kunci sandbox universal agar sistem pembayaran langsung aktif
let snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-ToDWmJ7ik3ydiDynamicKey'
});

// Endpoint untuk mengambil data item ke halaman depan
app.get('/api/items', (req, res) => {
    res.json(ITEMS_DATABASE);
});

// Endpoint untuk proses pembuatan token pembayaran Midtrans
app.post('/api/checkout', async (req, res) => {
    try {
        const { itemId, robloxUsername } = req.body;
        const item = ITEMS_DATABASE[itemId];

        if (!item || !robloxUsername) {
            return res.status(400).json({ error: "Data tidak valid!" });
        }

        const orderId = `GAG2-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        let parameter = {
            "transaction_details": { "order_id": orderId, "gross_amount": item.price },
            "item_details": [{ "id": itemId, "price": item.price, "quantity": 1, "name": item.name }],
            "customer_details": { "first_name": robloxUsername, "email": `${robloxUsername}@robloxuser.com` },
            "enabled_payments": ["gopay", "shopeepay", "qris", "bca_va", "bni_va", "bri_va"]
        };

        const transaction = await snap.createTransaction(parameter);
        res.json({ token: transaction.token, redirect_url: transaction.redirect_url, orderId: orderId });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Gagal memproses transaksi." });
    }
});

// Endpoint notifikasi ketika pembeli selesai membayar
app.post('/api/payment-notification', (req, res) => {
    let notificationJson = req.body;
    snap.transaction.notification(notificationJson)
        .then((statusResponse) => {
            let orderId = statusResponse.order_id;
            let transactionStatus = statusResponse.transaction_status;
            let fraudStatus = statusResponse.fraud_status;
            let grossAmount = statusResponse.gross_amount;
            let robloxUsername = statusResponse.customer_details ? statusResponse.customer_details.first_name : "Unknown";

            const discordWebhookUrl = "https://discord.com/api/webhooks/1518106290440769577/-1ihe8omRW-l9RW7S6piMGWZAkR66bi-X2AnKvIX-p1XoilNHljKbnInJfpOCqIyKTru";

            if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
                if (discordWebhookUrl) {
                    fetch(discordWebhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: "Toko Roblox Notifier",
                            avatar_url: "https://images.rbxcdn.com/97486801967262c502da285d820ef681.png",
                            embeds: [{
                                title: "🎉 TRANSAKSI BERHASIL! 🎉",
                                color: 3066993,
                                fields: [
                                    { name: "Order ID", value: orderId, inline: true },
                                    { name: "Username Roblox", value: robloxUsername, inline: true },
                                    { name: "Total Bayar", value: `Rp ${Number(grossAmount).toLocaleString('id-ID')}`, inline: false }
                                ],
                                timestamp: new Date()
                            }]
                        })
                    }).catch(err => console.error("Gagal kirim ke Discord:", err));
                }
            }

            res.status(200).send('OK');
        }).catch((err) => {
            console.error(err);
            res.status(500).send('Error');
        });
});

const PORT = process.env.PORT || 3000;
app.use(express.json());
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});