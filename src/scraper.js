import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ArgenpropScraper {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.listingsFile = join(__dirname, '../data/listings.json');
    this.pageNumber = 1;
    this.monitorBot = null;
  }

  setMonitorBot(bot) {
    this.monitorBot = bot;
  }

  async initialize() {
    this.browser = await chromium.launch({
      headless: true,
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async scrapeListings(url) {
    const page = await this.browser.newPage();
    const allListings = [];
    console.log(`Scanning: ${this.baseUrl} - Page ${this.pageNumber}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      
      // Extract listings from current page
      const listings = await page.locator('.listing__item').all();
      
      for (const listing of listings) {
        try {
          const listingId = await listing.getAttribute('id');
          const card = listing.locator('.card').first();
          const cardLink = await card.getAttribute('href');
          
          // Get image - try multiple selectors
          let imgSrc = null;
          const selectors = [
            'ul.card__photos li img',
            '.card__photos img',
            'img.card__photo',
            '.card_photo img',
            'picture img',
            '[data-src]'
          ];
          
          for (const selector of selectors) {
            const imgElement = listing.locator(selector).first();
            if (await imgElement.count() > 0) {
              // Try src attribute first
              imgSrc = await imgElement.getAttribute('src');
              
              // If src is empty, try data-src
              if (!imgSrc) {
                imgSrc = await imgElement.getAttribute('data-src');
              }
              
              // If still empty, try data-lazy
              if (!imgSrc) {
                imgSrc = await imgElement.getAttribute('data-lazy');
              }
              
              if (imgSrc) {
                break;
              }
            }
          }
          
          // Get text content
          const price = await listing.locator('.card__price').first().textContent();
          const address = await listing.locator('.card__address').first().textContent();
          const title = await listing.locator('.card__title').first().textContent();
          const info = await listing.locator('.card__info').first().textContent();
          
          // Optional fields
          let bedrooms = null;
          let environments = null;
          
          const bedroomsElement = listing.locator('.basico1-icon-cantidad_dormitorios').first();
          const environmentsElement = listing.locator('.basico1-icon-cantidad_ambientes').first();
          
          if (await bedroomsElement.count() > 0) {
            bedrooms = await bedroomsElement.textContent();
          }
          
          if (await environmentsElement.count() > 0) {
            environments = await environmentsElement.textContent();
          }
          
          allListings.push({
            id: listingId,
            link: cardLink ? (cardLink.startsWith('http') ? cardLink : this.baseUrl + cardLink) : null,
            image: imgSrc,
            price: price?.trim().replace(/\s*\n\s*/g, ' ') || null,
            address: address?.trim().replace(/\s*\n\s*/g, ' ') || null,
            title: title?.trim().replace(/\s*\n\s*/g, ' ') || null,
            info: info?.trim().replace(/\s*\n\s*/g, ' ') || null,
            bedrooms: bedrooms?.trim() || null,
            environments: environments?.trim() || null,
            scrapedAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Error extracting listing:', error.message);
        }
      }
      
      // Check for pagination
      const nextPageButton = page.locator('.pagination__page-next.pagination__page span[data-link-href]').first();
      if (await nextPageButton.count() > 0) {
        const nextUrl = await nextPageButton.getAttribute('data-link-href');
        if (nextUrl) {
          const fullNextUrl = nextUrl.startsWith('http') ? nextUrl : this.baseUrl + nextUrl;
          this.pageNumber++;
          const nextListings = await this.scrapeListings(fullNextUrl);
          allListings.push(...nextListings);
        }
      }
      
      return allListings;
    } catch (error) {
      console.error('Error scraping page:', error.message);
      return allListings;
    } finally {
      await page.close();
    }
  }

  loadExistingListings() {
    try {
      if (fs.existsSync(this.listingsFile)) {
        const data = fs.readFileSync(this.listingsFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading existing listings:', error.message);
    }
    return [];
  }

  saveListings(listings) {
    try {
      fs.writeFileSync(this.listingsFile, JSON.stringify(listings, null, 2));
      console.log(`Saved ${listings.length} listings to ${this.listingsFile}`);
    } catch (error) {
      console.error('Error saving listings:', error.message);
    }
  }

  async scanForNewListings(url) {
    this.pageNumber = 1; // Reset page counter
    console.log(`Starting scan...`);
    
    // Send status message to monitor chat
    if (this.monitorBot) {
      try {
        await this.monitorBot.sendMessage(`BOT | Alquiler CABA 🟢`);
      } catch (error) {
        console.error('Could not send monitor message:', error.message);
      }
    }
    
    try {
      const existingListings = this.loadExistingListings();
      const isFirstRun = existingListings.length === 0;
      
      if (isFirstRun) {
        console.log('First run detected. Loading initial listings without sending notifications...');
      }
      
      const existingIds = new Set(existingListings.map(l => l.id));
      
      const scrapedListings = await this.scrapeListings(url);
      
      // Find new listings
      let newListings = scrapedListings.filter(l => !existingIds.has(l.id));
      
      // On first run, don't send notifications for all initial listings
      if (isFirstRun) {
        newListings = [];
      }
      
      // Merge and save all listings
      const allListings = [...scrapedListings, ...existingListings.filter(existing => !scrapedListings.find(s => s.id === existing.id))];
      this.saveListings(allListings);
      
      console.log(`Found ${scrapedListings.filter(l => !existingIds.has(l.id)).length} new listings out of ${scrapedListings.length} total listings`);
      if (isFirstRun) {
        console.log('Stored all listings. Ready to monitor for new ones.');
      }
    
      return {
        newListings,
        totalScraped: scrapedListings.length,
        newCount: newListings.length,
        isFirstRun,
      };
    } catch (error) {
      console.error('Error scanning for new listings:', error.message);
      return {
        newListings: [],
        totalScraped: 0,
        newCount: 0,
        isFirstRun: false,
      };
    }
  }
}
