// register user 
export const registerUser = async (req, res, users) => {
  try {
    console.log(req.body);
    const { uid, email, fullName, image, role = "user", work = null } = req.body;

    if (!uid || !email || !fullName) {
      return res.status(400).json({ error: "UID, email, and fullName are required" });
    }

    const existingUser = await users.findOne({ email });

    if (existingUser) {
      return res.status(200).json({
        error: "User already registered",
        user: {
          id: existingUser._id.toString(),
          email: existingUser.email,
          username: existingUser.username,
          image: existingUser.image,
          role: existingUser.role,
          work: existingUser.work,
        },
      });
    }

    const newUser = {
      uid,
      email,
      username: fullName,
      image: image || null,
      role,
      work,
      createdAt: new Date(),
    };

    const result = await users.insertOne(newUser);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: result.insertedId.toString(),
        email,
        uid,
        username: fullName,
        image,
        role,
        work,
      },
    });
  } catch (error) {
    console.error("Register user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// login user
export const loginUser= async (req,res,users)=>{

      try {
        const {
          uid,
          email,
          fullName,
          image = null,
          role = "user",
          work = null,
        } = req.body;

        if (!email || !uid) {
          return res.status(400).json({ error: "Email and UID are required" });
        }

        // Look for existing user by email
        let userDoc = await users.findOne({ email });

        if (userDoc) {
          return res.json({
            success: true,
            message: "User already exists",
            user: {
              id: userDoc._id.toString(),
              email: userDoc.email,
              username: userDoc.username,
              image: userDoc.image,
              role: userDoc.role,
              work: userDoc.work,
            },
          });
        }

        // Create username from fullName by removing spaces & lowercasing, fallback to email prefix
        let username = "";
        if (fullName && typeof fullName === "string") {
          username = fullName.trim().toLowerCase().replace(/\s+/g, "");
        } else if (email) {
          username = email.split("@")[0]; // use prefix of email as username fallback
        } else {
          username = "user" + Math.floor(Math.random() * 10000); // fallback username if all else fails
        }

        // Create new user object
        const newUser = {
          uid,
          email,
          username,
          image,
          role,
          work,
          createdAt: new Date(),
        };

        // Insert new user into DB
        const result = await users.insertOne(newUser);
        userDoc = { ...newUser, _id: result.insertedId };

        return res.json({
          success: true,
          message: "User profile created successfully",
          user: {
            id: userDoc._id.toString(),
            email: userDoc.email,
            username: userDoc.username,
            image: userDoc.image,
            role: userDoc.role,
            work: userDoc.work,
          },
        });
      } catch (error) {
        console.error("findOrCreateUser error:", error);
        return res.status(500).json({ error: "An error occurred while processing user data" });
    }
   
}