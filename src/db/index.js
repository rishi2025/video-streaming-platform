import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {

        const connectionResult = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
        console.log(`MongoDB coonected! DB HOST: ${connectionResult.connection.host}`);

    } catch (error) {

        console.log("MONGODB connection failed!", error);
        process.exit(1);

    }
}

export default connectDB;
