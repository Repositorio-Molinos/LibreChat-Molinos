FROM node:20-alpine

WORKDIR /app

ARG MS365_MCP_VERSION=0.99.1
RUN npm install -g @softeria/ms-365-mcp-server@${MS365_MCP_VERSION}

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["ms-365-mcp-server"]
CMD ["--http", "0.0.0.0:3000"]
