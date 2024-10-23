const express = require('express');
const { JsonDB, Config } = require('node-json-db');
const axios = require('axios');
const cron = require('node-cron');

// Initialize the database
const db = new JsonDB(new Config("myDatabase", true, false, '/'));

const app = express();
app.use(express.json());

// Function to fetch data from the URL
async function fetchData() {
    try {
        const response = await axios.get('https://www.andhrajyothy.com/cms/articles/latest-articles');
        return response.data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

// Function to update the database
async function updateDatabase() {
    const data = await fetchData();
    if (data) {
        try {
            const existingData = await db.getData('/articles');
            const newData = data.filter(article => !existingData.some(existingArticle => existingArticle.id === article.id));
            const updatedData = data.filter(article => existingData.some(existingArticle => existingArticle.id === article.id && existingArticle.updatedAt !== article.updatedAt));

            if (newData.length > 0 || updatedData.length > 0) {
                // Prepend new articles to the existing list
                await db.push('/articles', [...newData, ...existingData], false);
                updatedData.forEach(async article => {
                    const index = existingData.findIndex(existingArticle => existingArticle.id === article.id);
                    await db.push(`/articles[${index}]`, article, true);
                });
                console.log('Database updated successfully');
            } else {
                console.log('No new or updated articles found');
            }
        } catch (error) {
            if (error.message.includes("Can't find dataPath")) {
                await db.push('/articles', data, false);
                console.log('Database initialized successfully');
            } else {
                console.error('Error updating database:', error);
            }
        }
    }
}

// Schedule the updateDatabase function to run every 5 minutes
cron.schedule('*/5 * * * *', updateDatabase);

// Endpoint to get all articles with pagination
app.get('/articles', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        const articles = await db.getData('/articles');
        const paginatedArticles = articles.slice(startIndex, endIndex);

        res.json({
            totalArticles: articles.length,
            totalPages: Math.ceil(articles.length / limit),
            currentPage: page,
            articles: paginatedArticles
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Initialize the database on server start
updateDatabase();
