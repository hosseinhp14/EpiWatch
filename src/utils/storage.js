const fs = require('fs');
const path = require('path');
const { setupLogger } = require('./logger');

const logger = setupLogger();
const STORAGE_FILE = path.join(__dirname, '../../data/groups.json');

// Ensure data directory exists
const ensureDataDir = () => {
    const dataDir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dataDir)) {
        try {
            fs.mkdirSync(dataDir, { recursive: true });
            logger.info(`Created data directory: ${dataDir}`);
        } catch (error) {
            logger.error(`Failed to create data directory: ${error.message}`);
        }
    }
};

// Save authorized groups to file
const saveGroups = (groups) => {
    ensureDataDir();
    try {
        // groups can be either an array of objects with chatId and topicId
        // or a Set of chatIds (legacy format)
        let dataToSave;
        
        if (groups instanceof Set) {
            // Convert Set to array of objects with chatId and null topicId
            dataToSave = Array.from(groups).map(chatId => ({
                chatId,
                topicId: null
            }));
            logger.info(`Converting legacy format (Set) to new format with topic IDs`);
        } else {
            // Assume it's already in the correct format
            dataToSave = groups;
        }
        
        const data = JSON.stringify(dataToSave, null, 2);
        fs.writeFileSync(STORAGE_FILE, data);
        logger.info(`Saved ${dataToSave.length} authorized groups to storage`);
        return true;
    } catch (error) {
        logger.error(`Failed to save groups: ${error.message}`);
        return false;
    }
};

// Load authorized groups from file
const loadGroups = () => {
    ensureDataDir();
    try {
        if (!fs.existsSync(STORAGE_FILE)) {
            logger.info('No storage file found, starting with empty groups');
            return [];
        }
        
        const data = fs.readFileSync(STORAGE_FILE, 'utf8');
        const parsedData = JSON.parse(data);
        
        // Check if it's in the new format (array of objects) or old format (array of IDs)
        const isNewFormat = Array.isArray(parsedData) && 
                           parsedData.length > 0 && 
                           typeof parsedData[0] === 'object' &&
                           'chatId' in parsedData[0];
        
        if (isNewFormat) {
            logger.info(`Loaded ${parsedData.length} authorized groups with topic IDs from storage`);
            return parsedData;
        } else {
            // Convert old format to new format
            const convertedData = parsedData.map(chatId => ({
                chatId,
                topicId: null
            }));
            logger.info(`Converted ${convertedData.length} groups from old format to new format with topic IDs`);
            return convertedData;
        }
    } catch (error) {
        logger.error(`Failed to load groups: ${error.message}`);
        return [];
    }
};

module.exports = {
    saveGroups,
    loadGroups
}; 