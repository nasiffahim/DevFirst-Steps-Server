export const allUsers = async (req, res, User) => {
  try {
    // Fetch all users except those with the role "admin"
    const users = await User.find({ role: { $ne: "admin" } }).toArray();

    // Send response with status 200 (OK)
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
