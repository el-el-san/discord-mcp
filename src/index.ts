#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Client, GatewayIntentBits, TextChannel, AttachmentBuilder } from 'discord.js';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { join } from 'path';

class DiscordMCPServer {
  private server: Server;
  private discordClient: Client;

  constructor() {
    this.server = new Server(
      {
        name: 'discord-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      await this.discordClient.destroy();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'discord_send_message',
            description: 'Send a text message to a Discord channel',
            inputSchema: {
              type: 'object',
              properties: {
                channel_id: {
                  type: 'string',
                  description: 'Discord channel ID',
                },
                message: {
                  type: 'string',
                  description: 'Message content to send',
                },
              },
              required: ['channel_id', 'message'],
            },
          },
          {
            name: 'discord_send_image',
            description: 'Send an image to a Discord channel',
            inputSchema: {
              type: 'object',
              properties: {
                channel_id: {
                  type: 'string',
                  description: 'Discord channel ID',
                },
                image_path: {
                  type: 'string',
                  description: 'Local path to the image file',
                },
                message: {
                  type: 'string',
                  description: 'Optional message to accompany the image',
                },
              },
              required: ['channel_id', 'image_path'],
            },
          },
          {
            name: 'discord_get_messages',
            description: 'Retrieve messages from a Discord channel',
            inputSchema: {
              type: 'object',
              properties: {
                channel_id: {
                  type: 'string',
                  description: 'Discord channel ID',
                },
                limit: {
                  type: 'number',
                  description: 'Number of messages to retrieve (default: 10, max: 100)',
                  minimum: 1,
                  maximum: 100,
                },
              },
              required: ['channel_id'],
            },
          },
          {
            name: 'discord_get_images',
            description: 'Retrieve images from a Discord channel',
            inputSchema: {
              type: 'object',
              properties: {
                channel_id: {
                  type: 'string',
                  description: 'Discord channel ID',
                },
                limit: {
                  type: 'number',
                  description: 'Number of messages to search for images (default: 50, max: 100)',
                  minimum: 1,
                  maximum: 100,
                },
              },
              required: ['channel_id'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (!args) {
          throw new Error('Arguments are required');
        }

        switch (name) {
          case 'discord_send_message':
            return await this.sendMessage(args.channel_id as string, args.message as string);

          case 'discord_send_image':
            return await this.sendImage(
              args.channel_id as string,
              args.image_path as string,
              args.message as string
            );

          case 'discord_get_messages':
            return await this.getMessages(
              args.channel_id as string,
              args.limit as number || 10
            );

          case 'discord_get_images':
            return await this.getImages(
              args.channel_id as string,
              args.limit as number || 50
            );

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async sendMessage(channelId: string, message: string) {
    if (!this.discordClient.isReady()) {
      throw new Error('Discord client is not ready');
    }

    const channel = await this.discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Channel not found or is not a text channel');
    }

    const sentMessage = await (channel as TextChannel).send(message);

    return {
      content: [
        {
          type: 'text',
          text: `Message sent successfully to channel ${channelId}. Message ID: ${sentMessage.id}`,
        },
      ],
    };
  }

  private async sendImage(channelId: string, imagePath: string, message?: string) {
    if (!this.discordClient.isReady()) {
      throw new Error('Discord client is not ready');
    }

    const channel = await this.discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Channel not found or is not a text channel');
    }

    try {
      const attachment = new AttachmentBuilder(imagePath);
      const sentMessage = await (channel as TextChannel).send({
        content: message || '',
        files: [attachment],
      });

      return {
        content: [
          {
            type: 'text',
            text: `Image sent successfully to channel ${channelId}. Message ID: ${sentMessage.id}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to send image: ${error}`);
    }
  }

  private async getMessages(channelId: string, limit: number) {
    if (!this.discordClient.isReady()) {
      throw new Error('Discord client is not ready');
    }

    const channel = await this.discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Channel not found or is not a text channel');
    }

    const messages = await (channel as TextChannel).messages.fetch({ limit });
    const messageData = messages.map(msg => ({
      id: msg.id,
      author: msg.author.username,
      content: msg.content,
      timestamp: msg.createdAt.toISOString(),
      attachments: msg.attachments.map(att => ({
        name: att.name,
        url: att.url,
        size: att.size,
      })),
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Retrieved ${messageData.length} messages from channel ${channelId}:\n\n${JSON.stringify(messageData, null, 2)}`,
        },
      ],
    };
  }

  private async getImages(channelId: string, limit: number) {
    if (!this.discordClient.isReady()) {
      throw new Error('Discord client is not ready');
    }

    const channel = await this.discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Channel not found or is not a text channel');
    }

    const messages = await (channel as TextChannel).messages.fetch({ limit });
    const imageData: any[] = [];

    messages.forEach(msg => {
      msg.attachments.forEach(attachment => {
        if (attachment.contentType?.startsWith('image/')) {
          imageData.push({
            messageId: msg.id,
            author: msg.author.username,
            timestamp: msg.createdAt.toISOString(),
            filename: attachment.name,
            url: attachment.url,
            size: attachment.size,
            contentType: attachment.contentType,
          });
        }
      });
    });

    return {
      content: [
        {
          type: 'text',
          text: `Retrieved ${imageData.length} images from channel ${channelId}:\n\n${JSON.stringify(imageData, null, 2)}`,
        },
      ],
    };
  }

  async start(): Promise<void> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN environment variable is required');
    }

    await this.discordClient.login(token);
    console.error('Discord client logged in successfully');

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Discord MCP server started');
  }
}

if (require.main === module) {
  const server = new DiscordMCPServer();
  server.start().catch(console.error);
}

export default DiscordMCPServer;