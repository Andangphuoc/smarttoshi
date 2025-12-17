import { UserData } from '../types';

const DB_KEY = 'hedging_app_database';

// Simulate network latency
const FAKE_LATENCY = 300; 

/**
 * Retrieves the entire mock database from localStorage.
 * @returns The database object, or an empty object if none exists.
 */
const getDatabase = (): Record<string, UserData> => {
  try {
    const dbString = localStorage.getItem(DB_KEY);
    return dbString ? JSON.parse(dbString) : {};
  } catch (error) {
    console.error("Failed to parse database from localStorage:", error);
    return {};
  }
};

/**
 * Saves the entire mock database to localStorage.
 * @param db The database object to save.
 */
const saveDatabase = (db: Record<string, UserData>): void => {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (error) {
    console.error("Failed to save database to localStorage:", error);
  }
};

/**
 * Simulates logging in a user.
 * It checks if the user exists in the database. If not, it creates a new entry for them.
 * @param username The username to log in or create.
 * @returns A promise that resolves with the user's data.
 */
export const loginUser = (username: string): Promise<UserData> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const db = getDatabase();
      
      if (!db[username]) {
        // User does not exist, create a new record for them with default data
        console.log(`User '${username}' not found. Creating new workspace.`);
        db[username] = {
          hedgedPairs: [], 
          monthlyVolumeTarget: 500000,
          startingEquity: 100000, // Default starting equity for new users
        };
        saveDatabase(db);
      } else {
        // Ensure existing users have the new field if they were created before it existed
        if (db[username].startingEquity === undefined) {
          db[username].startingEquity = 100000;
          saveDatabase(db);
        }
        console.log(`User '${username}' found. Loading workspace.`);
      }
      
      resolve(db[username]);
    }, FAKE_LATENCY);
  });
};

/**
 * Saves the data for a specific user.
 * @param username The user whose data is to be saved.
 * @param data The data (hedged pairs, target, and equity) to save.
 * @returns A promise that resolves when the data is saved.
 */
export const saveUserData = (username: string, data: UserData): Promise<void> => {
  return new Promise((resolve) => {
    // No latency needed for saving in this mock-up, could be added
    const db = getDatabase();
    db[username] = data;
    saveDatabase(db);
    resolve();
  });
};