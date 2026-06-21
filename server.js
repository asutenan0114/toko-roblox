const express = require('express');

const midtransClient = require('midtrans-client');

const bodyParser = require('body-parser');

const https = require('https'); // Menggunakan modul bawaan resmi Node.js agar tidak crash di Vercel

require('dotenv').config();

const path = require('path');

const app = express();

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public'));



// Data Item Berbagai Game (Sistem Stok)

let ITEMS_DATABASE = {

    "item-001": { name: "Seed Defender", price: 8000, desc: "Venus Fly Trap seed.", image: "/Venus Fly Trap seed.png", game: "grow-a-garden-2", stock: 50 },

    "item-002": { name: "Fasting grow Fruit", price: 5000, desc: "Super Sprinkler.", image: "/Super Sprinkler.jpg", game: "grow-a-garden-2", stock: 30 },

    "item-003": { name: "Grow up Fruit", price: 5000, desc: "Super Water Can.", image: "/Super Water Can.jpg", game: "grow-a-garden-2", stock: 25 },

    "item-004": { name: "Seed Event", price: 3000, desc: "Rainbow Seed.", image: "/Rainbow Seed.jpg", game: "grow-a-garden-2", stock: 100 },

    "item-005": { name: "Pet", price: 15000, desc: "Unicorn.", image: "/pet-unicorn.png", game: "grow-a-garden-2", stock: 10 },

    

    "item-006": { 

        name: "1B Gems / Diamonds", 

        price: 22000, 

        desc: "Gems legal aman proses cepat via Mailbox.", 

        image: "/gems.jpg", 

        game: "pet-simulator-99",

        stock: 5

    }

};



const SERVER_KEY_DOCK = process.env.MIDTRANS_SERVER_KEY && process.env.MIDTRANS_SERVER_KEY.trim() !== "" 

    ? process.env.MIDTRANS_SERVER_KEY 

    : 'SB-Mid-server-ToDWmJ7ik3ydiDynamicKey';



const IS_PROD = process.env.MIDTRANS_IS_PRODUCTION === 'true' || false;



let snap = new midtransClient.Snap({

    isProduction: IS_PROD,

    serverKey: SERVER_KEY_DOCK

});



// Endpoint mengambil data item

app.get('/api/items', (req, res) => {

    res.json(ITEMS_DATABASE);

});

app.get('/grow.html', (req, res) => {

    res.sendFile(path.join(__dirname, 'public', 'grow.html'));

});



app.get('/google08ce9b79e1fff29d.html', (req, res) => {

    res.sendFile(path.join(__dirname, 'public', 'google08ce9b79e1fff29d.html'));

});

// Proses Pembuatan Transaksi (Checkout) - Versi Akurat Tanpa Pembatasan Metode Pembayaran

app.post('/api/checkout', async (req, res) => {

    try {

        const { itemId, robloxUsername, quantity } = req.body;

        const item = ITEMS_DATABASE[itemId];

        const qty = parseInt(quantity) || 1;



        if (!item || !robloxUsername || qty < 1) {

            return res.status(400).json({ error: "Data tidak valid!" });

        }



        if (item.stock < qty) {

            return res.status(400).json({ error: `Stok tidak mencukupi! Sisa stok saat ini: ${item.stock}` });

        }



        const totalAmount = item.price * qty;

        const orderId = `ROBLOX-${itemId}-${qty}-${Date.now()}`;



        // UPDATE: Parameter dioptimalkan, enabled_payments dihapus agar mengikuti dashboard secara dinamis

        let parameter = {

            "transaction_details": { 

                "order_id": orderId, 

                "gross_amount": totalAmount 

            },

            "item_details": [{ 

                "id": itemId, 

                "price": item.price, 

                "quantity": qty, 

                "name": `${item.name.substring(0, 45)} (x${qty})`

            }],

            "customer_details": { 

                "first_name": robloxUsername.replace(/[^a-zA-Z0-9]/g, ""), // Username pembeli bersih dari simbol aneh

                "last_name": "Store",

                "email": "slebewbebew545@gmail.com", // Sesuai dengan email profil Midtrans Anda

                "phone": "+6282119392845" // Sesuai dengan nomor HP profil Midtrans Anda

            }

        };



        const transaction = await snap.createTransaction(parameter);

        res.json({ token: transaction.token, redirect_url: transaction.redirect_url, orderId: orderId });



    } catch (error) {

        console.error("Midtrans Error Detail:", error.message);

        res.status(500).json({ error: "Gagal memproses transaksi.", details: error.message });

    }

});



// Endpoint Notifikasi Midtrans

app.post('/api/payment-notification', (req, res) => {

    let notificationJson = req.body;

    snap.transaction.notification(notificationJson)

        .then((statusResponse) => {

            let orderId = statusResponse.order_id;

            let transactionStatus = statusResponse.transaction_status;

            let grossAmount = statusResponse.gross_amount;

            let robloxUsername = statusResponse.customer_details ? statusResponse.customer_details.first_name : "Unknown";



            if (transactionStatus == 'capture' || transactionStatus == 'settlement') {

                const parts = orderId.split('-');

                if (parts[1] === 'item' && parts[2]) {

                    const targetItemId = `${parts[1]}-${parts[2]}`;

                    const purchasedQty = parseInt(parts[3]) || 1;



                    if (ITEMS_DATABASE[targetItemId]) {

                        ITEMS_DATABASE[targetItemId].stock = Math.max(0, ITEMS_DATABASE[targetItemId].stock - purchasedQty);

                    }

                }



                // Kirim ke Discord menggunakan HTTPS bawaan Node.js agar anti-crash di Vercel

                const discordWebhookUrl = "https://discord.com/api/webhooks/1518106290440769577/-1ihe8omRW-l9RW7S6piMGWZAkR66bi-X2AnKvIX-p1XoilNHljKbnInJfpOCqIyKTru";

                

                const discordData = JSON.stringify({

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

                });



                const urlParts = new URL(discordWebhookUrl);

                const options = {

