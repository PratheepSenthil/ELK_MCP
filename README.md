# ELK MCP Server

**ELK MCP** is a bridge between Large Language Models (LLMs) and the **ELK Stack (Elasticsearch, Logstash, Kibana)**, built on the **Model Context Protocol (MCP)**. It transforms your ELK-based SIEM into an AI-controllable security operations hub, allowing agents to query logs, analyze alerts, and perform threat hunting through standardized tool interfaces.

---

## Overview
This server allows AI agents (such as Claude) to interact directly with your Security Information and Event Management (SIEM) data. By providing the LLM with structured tools to access Elasticsearch, you can automate complex security investigations and log analysis using natural language.

## Key Features
* **AI-Driven SIEM:** Perform natural language queries against security indices.
* **Incident Investigation:** Tools for the LLM to fetch alert details, correlate events, and summarize threats.
* **Log Exploration:** Search across `logs-*`, `metrics-*`, or custom indices with ease.
* **MCP Compliant:** Fully compatible with any MCP client (Claude Desktop, etc.).

## Tech Stack
* **Protocol:** Model Context Protocol (MCP)
* **Platform:** Node.js / TypeScript
* **Data Source:** Elasticsearch (ELK Stack)

## Prerequisites
* **Node.js** (v18 or higher)
* An accessible **Elasticsearch** instance (Cloud or On-prem)
* **API Key** or credentials with read permissions for target indices

---

## Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/PratheepSenthil/ELK_MCP.git](https://github.com/PratheepSenthil/ELK_MCP.git)
   cd ELK_MCP
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Build the project:**
   ```bash
   npm run build
   ```
## Configuration

### Environment Variables

Create a `.env` file or export the following variables:

* `ELASTIC_URL`: Your Elasticsearch endpoint.
* `ELASTIC_API_KEY`: Your Elastic API Key.

### Connecting to Claude Desktop

Add the server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "elk-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/ELK_MCP/build/index.js"],
      "env": {
        "ELASTIC_URL": "https://your-elastic-instance:9243",
        "ELASTIC_API_KEY": "your-api-key"
      }
    }
  }
}

```

---

## Usage Examples

Once the agent is connected, you can use prompts like:

* `Check for any 'Critical' severity alerts in the last 4 hours.`
* `Search the logs for any IP addresses associated with brute force attempts.`
* `Visualize the trend of 404 errors from my web traffic indices.`
