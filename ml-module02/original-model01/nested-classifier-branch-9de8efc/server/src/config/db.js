import mongoose from "mongoose";

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cinnamon_dashboard";

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("MongoDB connected");
    return true;
  } catch (error) {
    console.error(`MongoDB unavailable: ${error.message}`);
    return false;
  }
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}
