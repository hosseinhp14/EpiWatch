require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const { scrapeTvShows } = require('./scraper');
const { setupLogger } = require('./utils/logger');
const { saveGroups, loadGroups } = require('./utils/storage');

const logger = setupLogger();

// Validate bot token
if (!process.env.BOT_TOKEN) {
    logger.error('BOT_TOKEN is not set in .env file');
    process.exit(1);
}

// Initialize bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Store bot info
let botInfo = null;

// Get bot info on startup
bot.getMe().then((info) => {
    botInfo = info;
    logger.info(`Bot initialized successfully: @${botInfo.username} (ID: ${botInfo.id})`);
}).catch((error) => {
    logger.error(`Failed to initialize bot: ${error.message}`);
    process.exit(1);
});

// Load authorized groups from storage
const authorizedGroups = loadGroups();

// Save groups on process exit
process.on('SIGINT', () => {
    logger.info('Saving groups before exit');
    saveGroups(authorizedGroups);
    process.exit(0);
});

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const isGroup = msg.chat.type !== 'private';
    
    // Ensure bot info is available
    if (!botInfo) {
        try {
            botInfo = await bot.getMe();
            logger.info(`Retrieved bot info: @${botInfo.username} (ID: ${botInfo.id})`);
        } catch (error) {
            logger.error(`Failed to get bot info: ${error.message}`);
            bot.sendMessage(chatId, 'An error occurred while initializing the bot. Please try again later.');
            return;
        }
    }
    
    if (isGroup) {
        try {
            logger.info(`Checking admin status for group ${chatId}`);
            logger.info(`Bot ID: ${botInfo.id}`);
            
            // Use bot ID instead of username
            const chatMember = await bot.getChatMember(chatId, botInfo.id);
            logger.info(`Chat member status: ${chatMember.status}`);
            
            if (chatMember.status === 'administrator') {
                authorizedGroups.add(chatId);
                saveGroups(authorizedGroups);
                bot.sendMessage(chatId, 'Bot is now active and will send daily TV show updates!');
                logger.info(`Bot authorized in group: ${chatId}`);
            } else {
                bot.sendMessage(chatId, 'Please make me an administrator to enable daily updates.');
                logger.warn(`Bot is not an admin in group ${chatId}. Current status: ${chatMember.status}`);
            }
        } catch (error) {
            logger.error(`Error checking admin status: ${error.message}`);
            logger.error(`Full error details: ${JSON.stringify(error, null, 2)}`);
            bot.sendMessage(chatId, 'An error occurred while checking permissions. Please ensure the bot is an administrator and try again.');
        }
    } else {
        bot.sendMessage(chatId, 'Please add me to a group and make me an administrator to enable daily updates.');
    }
});

// Handle /update command to manually trigger TV show update
bot.onText(/\/update/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Check if the chat is authorized
    if (!authorizedGroups.has(chatId)) {
        bot.sendMessage(chatId, 'This group is not authorized. Please use /start to authorize the bot first.');
        return;
    }
    
    bot.sendMessage(chatId, 'Fetching today\'s TV shows...');
    
    try {
        const showsData = await scrapeTvShows();
        const message = formatShowsMessage(showsData);
        
        // If we have a featured image, send it with the message as caption
        if (showsData.featuredImageUrl) {
            // Make sure the URL is properly formatted with https:
            const imageUrl = showsData.featuredImageUrl.startsWith('https://') 
                ? showsData.featuredImageUrl 
                : `https:${showsData.featuredImageUrl}`;
            
            logger.info(`Attempting to send image: ${imageUrl}`);
            
            try {
                await bot.sendPhoto(chatId, imageUrl, { 
                    caption: message,
                    parse_mode: 'HTML'
                });
                logger.info(`Manual update with image sent to group: ${chatId}`);
            } catch (imageError) {
                logger.error(`Error sending image: ${imageError.message}`);
                // Fallback to text-only message if image sending fails
                await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
                logger.info(`Fallback to text-only message after image error`);
            }
        } else {
            // Fallback to text-only message if no image is available
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            logger.info(`Manual update (text only) sent to group: ${chatId}`);
        }
    } catch (error) {
        logger.error(`Error in manual update: ${error.message}`);
        bot.sendMessage(chatId, 'An error occurred while fetching TV shows. Please try again later.');
    }
});

// Schedule daily message
const scheduleDailyUpdate = () => {
    // Schedule for 9:00 AM every day
    schedule.scheduleJob('0 9 * * *', async () => {
        try {
            const showsData = await scrapeTvShows();
            const message = formatShowsMessage(showsData);
            
            for (const groupId of authorizedGroups) {
                try {
                    // If we have a featured image, send it with the message as caption
                    if (showsData.featuredImageUrl) {
                        // Make sure the URL is properly formatted with https:
                        const imageUrl = showsData.featuredImageUrl.startsWith('https://') 
                            ? showsData.featuredImageUrl 
                            : `https:${showsData.featuredImageUrl}`;
                        
                        logger.info(`Attempting to send image: ${imageUrl}`);
                        
                        try {
                            await bot.sendPhoto(groupId, imageUrl, { 
                                caption: message,
                                parse_mode: 'HTML'
                            });
                            logger.info(`Daily update with image sent to group: ${groupId}`);
                        } catch (imageError) {
                            logger.error(`Error sending image: ${imageError.message}`);
                            // Fallback to text-only message if image sending fails
                            await bot.sendMessage(groupId, message, { parse_mode: 'HTML' });
                            logger.info(`Fallback to text-only message after image error`);
                        }
                    } else {
                        // Fallback to text-only message if no image is available
                        await bot.sendMessage(groupId, message, { parse_mode: 'HTML' });
                        logger.info(`Daily update (text only) sent to group: ${groupId}`);
                    }
                } catch (error) {
                    logger.error(`Error sending message to group ${groupId}: ${error.message}`);
                }
            }
        } catch (error) {
            logger.error(`Error in daily update: ${error.message}`);
        }
    });
};

const formatShowsMessage = (shows) => {
    if (!shows || (!shows.yesterday?.length && !shows.today?.length && !shows.tomorrow?.length)) {
        return 'No TV shows found.';
    }

    let message = '';
    
    // Format today's shows
    if (shows.today && shows.today.length > 0) {
        message += '📺 <b>TV Shows Airing Today:</b>\n\n';
        shows.today.forEach(show => {
            message += `• <b>${show.title}</b> | ${show.time}\n`;
        });
    } else {
        message += '📺 <b>No TV shows found for today</b>\n\n';
    }
    
    // Add a separator
    message += '\n';
    
    // Format tomorrow's shows
    if (shows.tomorrow && shows.tomorrow.length > 0) {
        message += '📺 <b>TV Shows Airing Tomorrow:</b>\n\n';
        shows.tomorrow.forEach(show => {
            message += `• <b>${show.title}</b> | ${show.time}\n`;
        });
    } else {
        message += '📺 <b>No TV shows found for tomorrow</b>\n\n';
    }
    
    // Add a separator
    message += '\n';
    
    // Format yesterday's shows
    if (shows.yesterday && shows.yesterday.length > 0) {
        message += '📺 <b>TV Shows That Aired Yesterday:</b>\n\n';
        shows.yesterday.forEach(show => {
            message += `• <b>${show.title}</b> | ${show.time}\n`;
        });
    }
    
    return message;
};

// Start the bot
logger.info('Starting TV Show Telegram Bot...');
scheduleDailyUpdate(); 