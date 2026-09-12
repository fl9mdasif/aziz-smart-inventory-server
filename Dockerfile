# 1. Base Image
FROM node:18-alpine

# 2. Set working directory inside the container
WORKDIR /app

# 3. Copy package files and install dependencies
# This caches your node_modules layer
COPY package*.json ./
RUN npm install

# 4. Copy the rest of your app's code
COPY . .

# 5. Build your TypeScript code into JavaScript
RUN npm run build

# 6. Expose the port your server runs on
EXPOSE 5000

# 7. Command to run the *production* server
CMD [ "npm", "start" ]