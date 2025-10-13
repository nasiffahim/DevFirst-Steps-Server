export const learning = async (req, res, learnings) => {
  try {
    const learn = await learnings.find().toArray();

    if (!learn || learn.length === 0) {
      return res.status(404).json({ message: "No learning data found" });
    }

    // Return the learning data
    return res.status(200).json(learn);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};
