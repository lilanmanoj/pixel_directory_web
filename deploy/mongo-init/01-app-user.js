// Runs once, on first start with an empty data volume.
// Creates a user that can only read/write the application database.
const dbName = process.env.APP_DB_NAME || 'pixel_directory';

db.getSiblingDB(dbName).createUser({
  user: process.env.APP_DB_USER,
  pwd: process.env.APP_DB_PASSWORD,
  roles: [{ role: 'readWrite', db: dbName }],
});

print(`Created application user "${process.env.APP_DB_USER}" on database "${dbName}"`);
