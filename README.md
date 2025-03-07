# TV Show Telegram Bot

A Telegram bot that sends daily updates about TV shows airing on the current day. The bot scrapes data from next-episode.net and sends formatted messages to authorized Telegram groups.

## Features

- Daily TV show updates at 9:00 AM
- Automatic scraping from next-episode.net
- Group-based authorization system
- Robust error handling and logging
- HTML-formatted messages

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Telegram Bot Token (get it from [@BotFather](https://t.me/botfather))

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tvshow-telegram-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Telegram bot token:
```
BOT_TOKEN=your_bot_token_here
```

4. Create a `logs` directory:
```bash
mkdir logs
```

## Usage

1. Start the bot:
```bash
npm start
```

2. For development with auto-reload:
```bash
npm run dev
```

3. Add the bot to a Telegram group and make it an administrator.

4. Send the `/start` command in the group to activate the bot.

## Configuration

The bot is configured to send updates at 9:00 AM daily. To change this, modify the schedule in `src/index.js`:

```javascript
schedule.scheduleJob('0 9 * * *', async () => {
    // ... update logic
});
```

## Logging

Logs are stored in the `logs` directory:
- `error.log`: Contains only error messages
- `combined.log`: Contains all log messages

## Error Handling

The bot includes comprehensive error handling for:
- Website scraping failures
- Network issues
- Permission problems
- Message sending failures

All errors are logged and won't crash the bot.

## Contributing

Feel free to submit issues and enhancement requests! 