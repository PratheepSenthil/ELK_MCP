import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';
import { 
          createIndex, 
          countDocuments, 
          getClusterHealth,
          createDocument, 
          getShardInfo, 
          searchQuery, 
          refreshIndex, 
          getAliases,
          createIncident,
          checkIpAddress,
          updateIncident
        } from './tools.ts';


// MCP compliant content types
export interface TextContent {
  type: "text";
  text: string;
  [key: string]: unknown; // This is for the index signature requirement
}

export type ContentFragment = TextContent;

export interface ResponseContent {
  content: ContentFragment[];
  [key: string]: unknown; // This is for the index signature requirement
}

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Main function to set up and start the server
async function main() {
  console.error('Log: Server starting...');

  // 1. Create the McpServer instance
  const server = new McpServer(
    {
      name: 'mcp-elasticsearch-server',
      version: '1.0.1',
    }
  );

  server.registerTool(
    'get_cluster_health',
    {
      description: 'Gets the cluster health including all metadata for the cluster.',
      inputSchema: {},
    },
    async () => {
      const resultText = await getClusterHealth();
      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    }
  );

  server.registerTool(
    'get_shards',
    {
      description: 'Get shard information.',
      inputSchema: {
        index: z.string().describe('Optional index name to filter shards.'),
      },
    },
    async ({ index }) => {
      const result = await getShardInfo(index);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  server.registerTool(
    'create_index',
    {
      description: 'Creates a new index in Elasticsearch.',
      inputSchema: {
        indexName: z.string().describe('The name of the index to create.'),
      },
    },
    async ({ indexName }) => {
      const resultText = await createIndex(indexName);
      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    }
  );

  server.registerTool(
    'count_documents',
    {
      description: 'Checks for the number of documents in a given index.',
      inputSchema: {
        indexName: z.string().describe('The name of the index to check.'),
      },
    },
    async ({ indexName }) => {
      const resultText = await countDocuments(indexName);
      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    }
  );


  server.registerTool(
    'create_document',
    {
      description: 'Creates a new document in JSON format for a given index.',
      inputSchema: {
        indexName: z.string().describe('The name of the index.'),
        document: z.object({}).describe('The document to create in form of JSON.'),
      },
    },
    async ({ indexName, document }) => {
      const resultText = await createDocument(indexName, document);
      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    }
  );

  server.registerTool(
    'search_query',
    {
      description: 'Perform an Elasticsearch search with the provided query DSL, highlighting, and script fields',
      inputSchema: {
        index: z
          .string()
          .trim()
          .min(1, "Index name is required")
          .describe("Name of the Elasticsearch index to search"),

        queryBody: z
          .record(z.any())
          .describe(
            "Complete Elasticsearch query DSL object (can include query, size, from, sort, etc.)"
          ),

        scriptFields: z
          .record(
            z.object({
              script: z.object({
                source: z
                  .string()
                  .min(1, "Script source is required")
                  .describe("Painless script source code"),
                params: z
                  .record(z.any())
                  .optional()
                  .describe("Optional parameters for the script"),
                lang: z
                  .string()
                  .optional()
                  .default("painless")
                  .describe("Script language (defaults to painless)"),
              })
            })
          )
          .optional()
          .describe("Script fields to evaluate and include in the response"),
      },
    },
    async ({ index, queryBody, scriptFields }, extra) => {
        try {
          // Add script_fields to the query body if provided
          const enhancedQueryBody = { ...queryBody };
          if (scriptFields && Object.keys(scriptFields).length > 0) {
            enhancedQueryBody.script_fields = scriptFields;
          }

          const result = await searchQuery(index, enhancedQueryBody);
          console.log(result);

          // Extract the 'from' parameter from queryBody, defaulting to 0 if not provided
          const from = queryBody.from ?? 0;

          const contentFragments: TextContent[] = [];

          // Add metadata about the search results
          contentFragments.push({
            type: "text",
            text: `Total results: ${
              typeof result.hits.total === "number"
                ? result.hits.total
                : result.hits.total?.value ?? 0
            }, showing ${result.hits.hits.length} from position ${from}`,
          });

          // Add aggregation results if present
          if (result.aggregations) {
            contentFragments.push({
              type: "text",
              text: `Aggregations: ${JSON.stringify(
                result.aggregations,
                null,
                2
              )}`,
            });
          }

          // Process and add individual hit results
          result.hits.hits.forEach((hit: any) => {
            const highlightedFields = hit.highlight ?? {};
            const sourceData = hit._source ?? {};
            const scriptFieldsData = hit.fields ?? {};

            let content = `Document ID: ${hit._id}\nScore: ${hit._score}\n\n`;

            // Add script fields results
            for (const [field, value] of Object.entries(scriptFieldsData)) {
              content += `${field} (script): ${JSON.stringify(value)}\n`;
            }

            // Add highlighted fields
            for (const [field, highlights] of Object.entries(highlightedFields)) {
              if (Array.isArray(highlights) && highlights.length > 0) {
                content += `${field} (highlighted): ${(
                  highlights as string[]
                ).join(" ... ")}\n`;
              }
            }

            // Add source fields that weren't highlighted
            for (const [field, value] of Object.entries(sourceData)) {
              if (!(field in highlightedFields)) {
                content += `${field}: ${JSON.stringify(value)}\n`;
              }
            }

            contentFragments.push({
              type: "text",
              text: content.trim(),
            });
          });

          const response: ResponseContent = {
            content: contentFragments,
          };
          return response;
        } catch (error) {
          console.error(
            `Search failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          return {
            content: [
              {
                type: "text",
                text: `Error: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
          };
        }
      }
  );

  server.registerTool(
    'get_aliases',
    {
      description: 'Get index aliases.',
      inputSchema: {
        name: z.string().describe('Optional alias name to filter.'),
      },
    },
    async ({ name }) => {
      const result = await getAliases(name);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  server.registerTool(
    'refresh_index',
    {
      description: 'Refresh an index.',
      inputSchema: {
        index: z.string().describe('The name of the index to refresh.'),
      },
    },
    async ({ index }) => {
      const result = await refreshIndex(index);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  server.registerTool(
    'create_incident',
    {
      description: 'Creates a new incident in the \'incidents\' index.',
      inputSchema: {
        severity: z.enum(['low', 'medium', 'high', 'critical']).describe('The severity of the incident.'),
        service: z.string().describe('The service affected by the incident.'),
        title: z.string().describe('The title of the incident.'),
        description: z.string().describe('The description of the incident.'),
      },
    },
    async (incidentData) => {
      const result = await createIncident(incidentData);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  server.registerTool(
    'update_incident',
    {
      description: 'Update an existing incident by incidentId. You can change status and append text to the description.',
      inputSchema: {
        incidentId: z.string().describe('The incidentId to update.'),
        status: z
          .enum(['open', 'in_progress', 'resolved'])
          .optional()
          .describe('Optional new status for the incident.'),
        appendDescription: z.string().optional().describe('Optional text to append to the existing description.'),
      },
    },
    async ({ incidentId, status, appendDescription }) => {
  const result = await updateIncident(incidentId, { status, appendDescription } as any);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  server.registerTool(
    'check_ip_address',
    {
      description: 'Checks if an IP address is in a blocklist and returns the number of blacklists it is on.',
      inputSchema: {
        ipAddress: z.string().describe('The IP address to check.'),
      },
    },
    async ({ ipAddress }) => {
      const result = await checkIpAddress(ipAddress);
      return {
        content: [
          {
            type: 'text',
            text: result.toString(),
          },
        ],
      };
    }
  );

  // Set up transport and connect
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Log: Server connected successfully');
  
  // Send initialization logging message after connection
  server.sendLoggingMessage({
    level: "info",
    data: "ElasticSearch-MCP Server started successfully",
  });
}

// Start the server
main().catch((error) => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});
