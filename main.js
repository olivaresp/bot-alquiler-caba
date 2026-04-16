import dotenv from 'dotenv';
import { ArgenpropScraper } from './src/scraper.js';
import { TelegramBot } from './src/telegram.js';
import { Scheduler } from './src/scheduler.js';

// Load environment variables
dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_MONITOR_CHAT_ID = process.env.TELEGRAM_MONITOR_CHAT_ID || TELEGRAM_CHAT_ID;
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL || '600000', 10); // 10 minutes by default
const BASE_URL = process.env.BASE_URL || 'https://www.argenprop.com';

// URL to scrape
const SCRAPE_URL = 'https://www.argenprop.com/departamentos/alquiler/almagro-o-chacarita-o-colegiales-o-palermo-o-villa-crespo/dolares-400-600';

let scraper;
let telegramBot;
let monitorBot;
let scheduler;

const SCAN_MODE = process.argv.includes('--scan');

async function main() {
  try {
    // Validate environment variables
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env file');
      console.error('Please copy .env.example to .env and fill in your Telegram credentials');
      process.exit(1);
    }

    // Initialize scraper
    scraper = new ArgenpropScraper(BASE_URL);
    await scraper.initialize();

    if (SCAN_MODE) {
      console.log('Scan mode: loading initial listings without notifications...');
      const result = await scraper.scanForNewListings(SCRAPE_URL);
      console.log(`✅ Done. ${result.totalScraped} listings stored. Ready to run npm start.`);
      await scraper.close();
      process.exit(0);
    }

    console.log('Initializing: BOT | Alquiler CABA');
    console.log(`Scan Interval: ${SCAN_INTERVAL / 1000} seconds`);
    console.log('');

    // Initialize Telegram bot
    telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);

    // Initialize Monitor bot for status messages
    monitorBot = new TelegramBot(TELEGRAM_BOT_TOKEN, TELEGRAM_MONITOR_CHAT_ID);
    scraper.setMonitorBot(monitorBot);

    // Create scheduler callback
    const scanCallback = async () => {
      try {
        const result = await scraper.scanForNewListings(SCRAPE_URL);
        
        if (result.isFirstRun) {
          console.log(`✅ Initial data loaded: ${result.totalScraped} listings stored. Monitoring active.`);
          return;
        }
        
        if (result.newCount > 0) {
          console.log(`Found ${result.newCount} new listings!`);
          await telegramBot.sendListingsNotification(result.newListings);
        } else {
          console.log('No new listings found');
        }
      } catch (error) {
        console.error('Error during scan:', error.message);
        
        // Send error to monitor chat
        try {
          await monitorBot.sendMessage(`BOT | Alquiler CABA 🔴 - ${error.message}`);
        } catch (notifyError) {
          console.error('Could not send error notification:', notifyError.message);
        }
      }
    };

    // Initialize and start scheduler
    scheduler = new Scheduler(SCAN_INTERVAL, scanCallback);
    scheduler.start();
    
    // Send startup message
    try {
      await monitorBot.sendMessage(`BOT | Alquiler CABA 🟢`);
    } catch (error) {
      console.error('Could not send startup message:', error.message);
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down gracefully...');
      
      // Send shutdown message
      try {
        await monitorBot.sendMessage(`BOT | Alquiler CABA 🔴`);
      } catch (error) {
        console.error('Could not send shutdown message:', error.message);
      }
      
      if (scheduler) scheduler.stop();
      if (scraper) await scraper.close();
      process.exit(0);
    });

    console.log('Scraper is running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Fatal error:', error.message);
    
    // Try to send error message to monitor
    try {
      if (monitorBot) {
        await monitorBot.sendMessage(`BOT | Alquiler CABA 🔴 - ${error.message}`);
      }
    } catch (notifyError) {
      console.error('Could not send error notification:', notifyError.message);
    }
    
    process.exit(1);
  }
}

main();
