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
        const data = JSON.stringify(Array.from(groups));
        fs.writeFileSync(STORAGE_FILE, data);
        logger.info(`Saved ${groups.size} authorized groups to storage`);
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
            return new Set();
        }
        
        const data = fs.readFileSync(STORAGE_FILE, 'utf8');
        const groups = new Set(JSON.parse(data));
        logger.info(`Loaded ${groups.size} authorized groups from storage`);
        return groups;
    } catch (error) {
        logger.error(`Failed to load groups: ${error.message}`);
        return new Set();
    }
};

module.exports = {
    saveGroups,
    loadGroups
}; 