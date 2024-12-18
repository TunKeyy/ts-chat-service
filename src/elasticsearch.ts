import { Client } from "@elastic/elasticsearch";
import { ClusterHealthResponse } from "@elastic/elasticsearch/lib/api/types";
import { winstonLogger } from "@TunKeyy/leo-shared";
import { Logger } from "winston";
import { config } from "@chat/config";

const log: Logger = winstonLogger(`${config.ELASTIC_SEARCH_URL}`, "chatElasticSearchServer", "debug");

export const elasticSearchClient = new Client({
  node: `${config.ELASTIC_SEARCH_URL}`
});

export const checkConnection = async (): Promise<void> => {
  let isConnected = false;
  while (!isConnected) {
    try {
      const health: ClusterHealthResponse = await elasticSearchClient.cluster.health({});
      log.info(`ChatService Elasticsearch health status - ${health.status}`);
      isConnected = true;
    } catch (error) {
      log.error("Connection to Elasticsearch failed. Retrying...");
      log.log("error", "ChatService checkConnection() method:", error);
    }
  }
};