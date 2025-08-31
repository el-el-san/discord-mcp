#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Client, GatewayIntentBits, TextChannel, AttachmentBuilder, Message, Collection } from 'discord.js';
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
          {
            name: 'discord_get_messages_advanced',
            description: 'Advanced message retrieval with date range, keyword search, and pagination',
            inputSchema: {
              type: 'object',
              properties: {
                channel_id: {
                  type: 'string',
                  description: 'Discord channel ID',
                },
                limit: {
                  type: 'number',
                  description: 'Number of messages per page (default: 50, max: 100)',
                  minimum: 1,
                  maximum: 100,
                },
                before: {
                  type: 'string',
                  description: 'Get messages before this message ID (for pagination)',
                },
                after: {
                  type: 'string',
                  description: 'Get messages after this message ID (for pagination)',
                },
                start_date: {
                  type: 'string',
                  description: 'Start date in ISO format (e.g., 2024-01-01T00:00:00Z)',
                },
                end_date: {
                  type: 'string',
                  description: 'End date in ISO format (e.g., 2024-12-31T23:59:59Z)',
                },
                keyword: {
                  type: 'string',
                  description: 'Keyword to search in message content',
                },
                author: {
                  type: 'string',
                  description: 'Filter by author username or ID',
                },
                has_attachments: {
                  type: 'boolean',
                  description: 'Only get messages with attachments',
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

          case 'discord_get_messages_advanced':
            return await this.getMessagesAdvanced({
              channelId: args.channel_id as string,
              limit: args.limit as number || 50,
              before: args.before as string,
              after: args.after as string,
              startDate: args.start_date as string,
              endDate: args.end_date as string,
              keyword: args.keyword as string,
              author: args.author as string,
              hasAttachments: args.has_attachments as boolean,
            });

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
    await this.ensureDiscordReady();

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
    await this.ensureDiscordReady();

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
    await this.ensureDiscordReady();

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
    await this.ensureDiscordReady();

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

  private async getMessagesAdvanced(params: {
    channelId: string;
    limit?: number;
    before?: string;
    after?: string;
    startDate?: string;
    endDate?: string;
    keyword?: string;
    author?: string;
    hasAttachments?: boolean;
  }) {
    await this.ensureDiscordReady();

    const channel = await this.discordClient.channels.fetch(params.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Channel not found or is not a text channel');
    }

    const textChannel = channel as TextChannel;
    let allMessages: any[] = [];
    let lastMessageId: string | undefined = params.before;
    const targetLimit = params.limit || 50;
    let totalFetched = 0;
    const maxIterations = 10; // Prevent infinite loops
    let iterations = 0;

    // Parse dates if provided
    const startDate = params.startDate ? new Date(params.startDate) : null;
    const endDate = params.endDate ? new Date(params.endDate) : null;

    while (allMessages.length < targetLimit && iterations < maxIterations) {
      iterations++;
      
      // Fetch messages with pagination
      const fetchOptions: any = { limit: 100 };
      if (lastMessageId) fetchOptions.before = lastMessageId;
      if (params.after) fetchOptions.after = params.after;

      const fetchResult = await textChannel.messages.fetch(fetchOptions);
      // Check if fetch returned a single message or a collection
      const messages = fetchResult instanceof Message ? 
        new Collection<string, Message>([[fetchResult.id, fetchResult]]) : 
        fetchResult;
      
      if (messages.size === 0) break;

      // Convert to array and sort by timestamp (newest first)
      const messageArray = Array.from(messages.values()) as Message[];
      messageArray.sort((a, b) => b.createdTimestamp - a.createdTimestamp);

      for (const msg of messageArray) {
        // Date range filter
        if (startDate && msg.createdAt < startDate) {
          // If we've gone before the start date, stop fetching
          return {
            content: [
              {
                type: 'text',
                text: `Retrieved ${allMessages.length} messages matching criteria:\n\n${JSON.stringify(allMessages, null, 2)}`,
              },
            ],
          };
        }
        if (endDate && msg.createdAt > endDate) {
          continue; // Skip messages after end date
        }

        // Keyword filter
        if (params.keyword && !msg.content.toLowerCase().includes(params.keyword.toLowerCase())) {
          continue;
        }

        // Author filter
        if (params.author) {
          const authorMatch = msg.author.username === params.author || 
                            msg.author.id === params.author;
          if (!authorMatch) continue;
        }

        // Attachment filter
        if (params.hasAttachments && msg.attachments.size === 0) {
          continue;
        }

        // Add message to results
        allMessages.push({
          id: msg.id,
          author: msg.author.username,
          authorId: msg.author.id,
          content: msg.content,
          timestamp: msg.createdAt.toISOString(),
          attachments: msg.attachments.map(att => ({
            name: att.name,
            url: att.url,
            size: att.size,
            contentType: att.contentType,
          })),
          embeds: msg.embeds.length,
          reactions: msg.reactions.cache.size,
        });

        if (allMessages.length >= targetLimit) break;
      }

      // Update last message ID for next iteration
      const lastMessage = messageArray[messageArray.length - 1];
      if (lastMessage) {
        lastMessageId = lastMessage.id;
      }
      totalFetched += messages.size;

      // If we've fetched fewer messages than requested, we've reached the end
      if (messages.size < 100) break;
    }

    // Prepare summary
    const summary = {
      total: allMessages.length,
      filters: {
        dateRange: startDate || endDate ? 
          `${startDate ? startDate.toISOString() : 'any'} to ${endDate ? endDate.toISOString() : 'any'}` : 
          'none',
        keyword: params.keyword || 'none',
        author: params.author || 'any',
        hasAttachments: params.hasAttachments || false,
      },
      pagination: {
        before: params.before || 'none',
        after: params.after || 'none',
        totalFetched: totalFetched,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: `Advanced search results:\n\nSummary: ${JSON.stringify(summary, null, 2)}\n\nMessages:\n${JSON.stringify(allMessages, null, 2)}`,
        },
      ],
    };
  }

  private async ensureDiscordReady(): Promise<void> {
    if (this.discordClient.isReady()) {
      return;
    }

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN environment variable is required');
    }

    await this.discordClient.login(token);
    console.error('Discord client logged in successfully');
  }

  async start(): Promise<void> {
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