import dotenv from 'dotenv';
import { ArgenpropScraper } from './src/scraper.js';
import { TelegramBot } from './src/telegram.js';
import { Scheduler } from './src/scheduler.js';

// Load environment variables
dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL || '600000', 10); // 10 minutes by default
const BASE_URL = process.env.BASE_URL || 'https://www.argenprop.com';

// URL to scrape
const SCRAPE_URL = 'https://www.argenprop.com/departamentos/alquiler/almagro-o-chacarita-o-colegiales-o-palermo-o-villa-crespo/1-dormitorio-o-2-dormitorios/dolares-500-700';

let scraper;
let telegramBot;
let scheduler;

async function main() {
  try {
    // Validate environment variables
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env file');
      console.error('Please copy .env.example to .env and fill in your Telegram credentials');
      process.exit(1);
    }

    console.log('Initializing Argenprop Scraper...');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Scan Interval: ${SCAN_INTERVAL / 1000} seconds`);

    // Initialize scraper
    scraper = new ArgenpropScraper(BASE_URL);
    await scraper.initialize();

    // Initialize Telegram bot
    telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);

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
        
        // Notify about error
        try {
          await telegramBot.sendMessage(`❌ Error during scan: ${error.message}`);
        } catch (notifyError) {
          console.error('Could not send error notification:', notifyError.message);
        }
      }
    };

    // Initialize and start scheduler
    scheduler = new Scheduler(SCAN_INTERVAL, scanCallback);
    scheduler.start();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down gracefully...');
      if (scheduler) scheduler.stop();
      if (scraper) await scraper.close();
      process.exit(0);
    });

    console.log('Scraper is running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
