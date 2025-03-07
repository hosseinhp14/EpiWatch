const puppeteer = require('puppeteer');
const { setupLogger } = require('./utils/logger');
const fs = require('fs');
const path = require('path');

const logger = setupLogger();
const BASE_URL = 'https://next-episode.net';

const scrapeTvShows = async () => {
    let browser = null;
    try {
        logger.info('Starting TV show scraping process');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            timeout: 60000
        });
        
        const page = await browser.newPage();
        
        // Capture console logs from the browser
        page.on('console', msg => {
            const text = msg.text();
            logger.info(`Browser console: ${text}`);
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Navigate to the website
        logger.info(`Navigating to ${BASE_URL}`);
        await page.goto(BASE_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        // Wait for the page to load
        await page.waitForSelector('body', { timeout: 30000 });
        logger.info('Page loaded successfully');

        // Ensure logs directory exists
        const logsDir = path.join(__dirname, '../logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Take a screenshot for debugging
        await page.screenshot({ path: path.join(logsDir, 'homepage.png') });
        logger.info('Saved screenshot to logs/homepage.png');

        // Extract shows for yesterday, today, and tomorrow
        const result = await page.evaluate(() => {
            const yesterdayShows = [];
            const todayShows = [];
            const tomorrowShows = [];
            let featuredImageUrl = null;
            
            // Process Today's Top TV Episodes
            const todaySection = document.querySelector('span#home_today_episodes');
            if (todaySection) {
                const todayItems = todaySection.querySelectorAll('.homeitem');
                console.log(`Found ${todayItems.length} today items`);
                
                // Get the first show's image if available
                if (todayItems.length > 0) {
                    const firstItem = todayItems[0];
                    
                    // Based on the HTML structure provided, we need to find the image inside the span > a element
                    // The correct image is the one with attributes like width="99" height="73" align="left"
                    const showImageElement = firstItem.querySelector('span[style*="display:inline"] a img[align="left"]');
                    
                    if (showImageElement) {
                        const imgSrc = showImageElement.getAttribute('src');
                        console.log('Found show image src:', imgSrc);
                        
                        if (imgSrc && imgSrc.includes('/big/')) {
                            featuredImageUrl = imgSrc.replace('/big/', '/huge/');
                            console.log(`Converted to huge size: ${featuredImageUrl}`);
                        }
                    } else {
                        console.log('Could not find the show image with the specific selector');
                        
                        // Fallback: try to find any image that contains "/big/" in its src
                        const allImages = firstItem.querySelectorAll('img');
                        console.log(`Found ${allImages.length} total images in first item`);
                        
                        for (const img of allImages) {
                            const src = img.getAttribute('src');
                            console.log(`Image src: ${src}`);
                            
                            if (src && src.includes('/big/')) {
                                featuredImageUrl = src.replace('/big/', '/huge/');
                                console.log(`Found big image and converted to huge: ${featuredImageUrl}`);
                                break;
                            }
                        }
                    }
                }
                
                todayItems.forEach(item => {
                    const titleLink = item.querySelector('a[href^="//next-episode.net/"]');
                    const title = titleLink ? titleLink.textContent.trim() : 'Unknown Title';
                    
                    let episodeInfo = '';
                    const brTag = item.querySelector('br');
                    if (brTag && brTag.nextSibling) {
                        episodeInfo = brTag.nextSibling.textContent.trim();
                    }
                    
                    const titleAttr = titleLink ? titleLink.getAttribute('title') : '';
                    
                    todayShows.push({
                        title,
                        time: episodeInfo || 'Today',
                        episodeTitle: titleAttr
                    });
                });
            }
            
            // Process Tomorrow's Top TV Episodes
            const tomorrowHeading = Array.from(document.querySelectorAll('h2')).find(h => 
                h.textContent.includes("Tomorrow's Top TV Episodes")
            );
            
            if (tomorrowHeading) {
                const tomorrowSection = tomorrowHeading.closest('tr');
                if (tomorrowSection) {
                    const tomorrowItems = tomorrowSection.querySelectorAll('.homeitem');
                    tomorrowItems.forEach(item => {
                        const titleLink = item.querySelector('a[href^="//next-episode.net/"]');
                        const title = titleLink ? titleLink.textContent.trim() : 'Unknown Title';
                        
                        let episodeInfo = '';
                        const brTag = item.querySelector('br');
                        if (brTag && brTag.nextSibling) {
                            episodeInfo = brTag.nextSibling.textContent.trim();
                        }
                        
                        const titleAttr = titleLink ? titleLink.getAttribute('title') : '';
                        
                        tomorrowShows.push({
                            title,
                            time: episodeInfo || 'Tomorrow',
                            episodeTitle: titleAttr
                        });
                    });
                }
            }
            
            // Process Yesterday's Top TV Episodes
            const yesterdayHeading = Array.from(document.querySelectorAll('h2')).find(h => 
                h.textContent.includes("Yesterday's Top TV Episodes")
            );
            
            if (yesterdayHeading) {
                const yesterdaySection = yesterdayHeading.closest('tr');
                if (yesterdaySection) {
                    const yesterdayItems = yesterdaySection.querySelectorAll('.homeitem');
                    yesterdayItems.forEach(item => {
                        const titleLink = item.querySelector('a[href^="//next-episode.net/"]');
                        const title = titleLink ? titleLink.textContent.trim() : 'Unknown Title';
                        
                        let episodeInfo = '';
                        const brTag = item.querySelector('br');
                        if (brTag && brTag.nextSibling) {
                            episodeInfo = brTag.nextSibling.textContent.trim();
                        }
                        
                        const titleAttr = titleLink ? titleLink.getAttribute('title') : '';
                        
                        yesterdayShows.push({
                            title,
                            time: episodeInfo || 'Yesterday',
                            episodeTitle: titleAttr
                        });
                    });
                }
            }
            
            return {
                featuredImageUrl,
                yesterday: yesterdayShows,
                today: todayShows,
                tomorrow: tomorrowShows
            };
        });

        logger.info(`Successfully scraped ${result.yesterday.length} shows for yesterday, ${result.today.length} shows for today, and ${result.tomorrow.length} shows for tomorrow`);
        if (result.featuredImageUrl) {
            logger.info(`Featured image URL: ${result.featuredImageUrl}`);
        }
        
        return result;

    } catch (error) {
        logger.error(`Error scraping TV shows: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);
        
        // Return a fallback message if scraping fails
        return {
            featuredImageUrl: null,
            yesterday: [],
            today: [{
                title: "Scraping Error",
                time: "N/A",
                episodeTitle: "Please check next-episode.net manually"
            }],
            tomorrow: []
        };
    } finally {
        if (browser) {
            await browser.close();
            logger.info('Browser closed');
        }
    }
};

module.exports = {
    scrapeTvShows
}; 