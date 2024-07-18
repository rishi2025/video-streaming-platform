import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const registerUser = asyncHandler(async (req, res) => {

    // get user details from frontend
    const { fullName, email, username, password } = req.body;
    console.log("email: ", email);


    // validation - not empty
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required...");
    }

    // const existingUsername = User.findOne({
    //     $or: [{ username }]
    // });


    // check if user already exists: username, email
    const existingUsername = User.findOne({
        username
    });

    const existingEmail = User.findOne({
        email
    });

    if (existingUsername || existingEmail)
        throw new ApiError(409, `${existingEmail ? "Email" : "Username"} already exists.`);


    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath)
        throw new ApiError(400, "Avatar file is required...");


    // upload them to cloudinary, avatar
    const avatar = await uploadCloudinary(avatarLocalPath);
    const coverImage = await uploadCloudinary(coverImageLocalPath);

    if (!avatar)
        throw new ApiError(400, "Avatar file is required...");


    // create user object - create entry in db
    const user = await User.create({
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    });


    // remove hashed password and refresh token field from response
    const createdUser = User.find(user._id).select(
        "-password -refreshTokens"
    );


    // check for user creation
    if (!createdUser)
        throw new ApiError(500, "Something went wrong while registering the user...");


    // return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully !!!")
    )
});

export { registerUser };