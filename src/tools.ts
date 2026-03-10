import { v4 as uuidv4 } from 'uuid';
import { Client } from '@elastic/elasticsearch';
import fetch from 'node-fetch';


// Initialize the Elasticsearch client.
const client = new Client({ node: 'http://localhost:9200' });

/**
 * Creates a new index in Elasticsearch.
 * @param indexName The name of the index to create.
 */
export async function createIndex(indexName: string): Promise<string> {
  try {
    const indexExists = await client.indices.exists({ index: indexName });
    if (indexExists) {
      return `Index "${indexName}" already exists.`;
    }
    await client.indices.create({ index: indexName });
    return `Index "${indexName}" created successfully.`;
  } catch (error: any) {
    // In a real app, you'd want more robust error handling and logging
    console.error("Error creating index:", error);
    return `Error creating index: ${error.message}`;
  }
}

/**
 * Checks for documents in a given index.
 * @param indexName The name of the index to check.
 */
export async function countDocuments(indexName: string): Promise<string> {
  try {
    const { count } = await client.count({ index: indexName });
    return `Index "${indexName}" contains ${count} documents.`;
  } catch (error: any) {
    console.error("Error checking documents:", error);
    return `Error checking documents: ${error.message}`;
  }
}

/**
 * Creates a new document in a given index.
 * @param indexName The name of the index.
 * @param document The document to create.
 */
export async function createDocument(indexName: string, document: any): Promise<string> {
  try {
    await client.index({
      index: indexName,
      body: document,
    });
    return `Document created successfully in index "${indexName}".`;
  } catch (error: any) {
    console.error("Error creating document:", error);
    return `Error creating document: ${error.message}`;
  }
}

/**
 * Retrieves all documents for a given index.
 * @param index The name of the index.
 */
export async function getShardInfo(index: string): Promise<String> {
  const response = await client.cat.shards({
    index,
    format: "json",
  });

  return JSON.stringify(response);
}

/**
 * Retrieves all documents for a given index.
 * @param indexName The name of the index.
 */
// export async function getAllDocuments(indexName: string): Promise<string> {
//   try {
//     const body  = await client.search({
//       index: indexName,
//       body: {
//         query: {
//           match_all: {},
//         },
//       },
//     });
//     return JSON.stringify(body.hits.hits.map((hit: any) => hit._source));
//   } catch (error: any) {
//     console.error("Error getting documents:", error);
//     return `Error getting documents: ${error.message}`;
//   }
// }

/**
 * Gets the cluster health.
 */
export async function getClusterHealth(): Promise<string> {
  try {
    // const { body } = await client.cluster.health({});
    return JSON.stringify(await client.cluster.health({}));
  } catch (error: any) {
    console.error("Error getting cluster health:", error);
    return `Error getting cluster health: ${error.message}`;
  }
}

/**
 * Search using flexible query parameter
 */
export async function searchQuery(index: string, queryBody: any): Promise<any> {
  console.log("In search tool");
  return await client.search({
    index,
    ...queryBody,
  });
}

/**
 * Get index aliases
 */
export async function getAliases(name: string): Promise<any> {
  return await client.indices.getAlias({
    name
  });
}

/**
 * Refresh an index
 */
export async function refreshIndex(index: string): Promise<any> {
  return await client.indices.refresh({
    index
  });
}

/**
 * Creates a new incident in the 'incidents' index.
 * @param title The title of the incident.
 * @param description The description of the incident.
 */

// src/interfaces/incident.ts
export interface Incident {
  timestamp: string;
  incidentId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
}

const createIncidentsIndex = async (indexName: string) => {
  const indexExists = await client.indices.exists({ index: indexName });
  if (!indexExists) {
    await client.indices.create({
      index: indexName,
      mappings: {
        properties: {
          timestamp: { type: 'date' },
          incidentId: { type: 'keyword' },
          severity: { type: 'keyword' },
          service: { type: 'keyword' },
          title: { type: 'text' },
          description: { type: 'text' },
          status: { type: 'keyword' },
        },
      },
    });
    console.log(`Index '${indexName}' created.`);
  } else {
    console.log(`Index '${indexName}' already exists.`);
  }
};

const getDailyIndexName = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `incidents-${year}-${month}-${day}`;
};

export const createIncident = async (incidentData: Omit<Incident, 'incidentId' | 'timestamp' | 'status'>) => {
  const dailyIndexName = getDailyIndexName();
  await createIncidentsIndex(dailyIndexName);

  const newIncident: Incident = {
    incidentId: uuidv4(),
    timestamp: new Date().toISOString(),
    status: 'open',
    ...incidentData,
  };

  try {
    const response = await client.index({
      index: dailyIndexName,
      id: newIncident.incidentId,
      document: newIncident,
    });
    console.log('Incident created:', response);
    return newIncident;
  } catch (error) {
    console.error('Error creating incident:', error);
    return error;
    throw error;
  }
};

export async function checkIpAddress(ipAddress: string): Promise<number> {
  const url = 'https://raw.githubusercontent.com/stamparm/ipsum/refs/heads/master/ipsum.txt';
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    const lines = text.split('\n');
    const ipMap = new Map<string, number>();
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        const parts = line.split('\t');
        if (parts && parts.length >= 2) {
          const [ipRaw, countRaw] = parts;
          if (ipRaw && countRaw) {
            const ip = ipRaw.trim();
            const blacklistCount = parseInt(countRaw.trim(), 10);
            if (!isNaN(blacklistCount)) {
              ipMap.set(ip, blacklistCount);
            }
          }
        }
      }
    }
    if(ipMap.get(ipAddress))
      return ipMap.get(ipAddress)!;
    else
      return 0;
  } catch (error) {
    console.error('Error fetching or parsing IP list:', error);
    return 0;
  }
}

/**
 * Update an existing incident by incidentId.
 * Finds the incident across `incidents-*` indices, updates its status and appends text to the description.
 * @param incidentId The incidentId to find and update.
 * @param opts Object containing optional `status` and `appendDescription`.
 */
export async function updateIncident(
  incidentId: string,
  opts: { status?: Incident['status']; appendDescription?: string }
): Promise<Incident | { error: string }> {
  try {
    // Search for the document across daily incident indices
    const searchRes: any = await (client.search as any)({
      index: 'incidents-*',
      body: {
        size: 1,
        query: {
          term: { incidentId: incidentId },
        },
      },
    });

    const hits = (searchRes && searchRes.hits && searchRes.hits.hits) || [];
    if (hits.length === 0) {
      return { error: `Incident with id ${incidentId} not found` };
    }

    const hit = hits[0];
    const indexName = hit._index as string;
    const docId = hit._id as string;
    const current: Incident = hit._source as Incident;

    const newStatus = opts.status ?? current.status;
    const appendText = opts.appendDescription ? ` ${opts.appendDescription}` : '';
    const newDescription = current.description + appendText;

    // Perform the update
    await client.update({
      index: indexName,
      id: docId,
      doc: {
        status: newStatus,
        description: newDescription,
      },
    });

    // Return the updated document (constructed locally to avoid another network call)
    const updated: Incident = {
      ...current,
      status: newStatus,
      description: newDescription,
    };
    return updated;
  } catch (error: any) {
    console.error('Error updating incident:', error);
    return { error: error.message };
  }
}



