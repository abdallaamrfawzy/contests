const Topic = require("../../models/topics.js");
const cron = require('node-cron');
const { parseISO, format } = require('date-fns');
const asyncWrapper = require("../../utils/asyncWrapper");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const createTopic = asyncWrapper(async (req, res, next) => {
    const { title, description, deadline } = req.body;

    if (!title || !description || !deadline) {
        return next(appError.create("All fields are required", 400, "FAIL"));
    }
    const userId = req.currentUser.id;

    const newTopic = new Topic({
        title,
        description,
        deadline: new Date(deadline),
        owner: userId,
        isActive: new Date() < new Date(deadline),
    });

    try {
        await newTopic.save();

        const deadlineDate = parseISO(deadline);
        const cronPattern = format(deadlineDate, 's m H d M *');

        const task = cron.schedule(cronPattern, async () => {
            await handleTopicEnd(newTopic._id);
        });
        task.start();
        return res.status(201).json({ status: "Success", data: { Topic: newTopic } });
    } catch (error) {
        console.error("Error creating Topic:", error);
        return next(appError.create("Error creating Topic", 500, "FAIL"));
    }
});

async function handleTopicEnd(TopicId) {
    try {
        const topic = await Topic.findById(TopicId).populate('answers.user', 'username image');

        if (!topic) {
            console.error(`topic with ID ${TopicId} not found`);
            return;
        }

        const prompt = `a question: ${topic.title}. Analyze these  question And analyze the answers
        Briefly give your opinion on this topicWithout going into details
        Give only one answer without going into details ,Don't answer with questions, I just want one short answer from you: ${topic.answers.map(answer => answer.text).join(", ")}`;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const bestAnswer = response.text();
        console.log(`Best answer for topic ${topic.title}: ${bestAnswer}`);
        topic.isActive = false;
        topic.bestAnswer = bestAnswer;
        await topic.save();

    } catch (error) {
        console.error(`Error handling topic end for contest ID ${TopicId}:`, error);
    }
}


const getAllTopics = asyncWrapper(async (req, res, next) => {
    const topics = await Topic.find()
        .populate('owner', 'username')
        .populate('answers.user', 'username image');

    const formattedTopics = topics.map(topic => {
        const formattedAnswers = topic.answers.map(answer => ({
            text: answer.text,
            user: {
                id: answer.user._id,
                username: answer.user.username,
                image: answer.user.image
            }
        }));

        return {
            _id: topic._id,
            title: topic.title,
            description: topic.description,
            deadline: topic.deadline,
            owner: {
                id: topic.owner._id,
                username: topic.owner.username
            },
            isActive: topic.isActive,
            answers: formattedAnswers
        };
    });

    res.status(200).json({ status: "Success", data: { topics: formattedTopics } });
});


const getTopicById = async (req, res, next) => {
    const TopicId = req.params.id;

    try {
        const topic = await Topic.findById(TopicId)
            .populate('owner', 'username')
            .populate({
                path: 'answers.user',
                select: 'username image'
            });

        if (!topic) {
            return res.status(404).json({ message: 'Topic not found' });
        }

        const total = Date.parse(topic.deadline) - Date.parse(new Date());
        const seconds = Math.floor((total / 1000) % 60);
        const minutes = Math.floor((total / 1000 / 60) % 60);
        const hours = Math.floor((total / 1000 / 60 / 60) % 24);
        const days = Math.floor(total / (1000 * 60 * 60 * 24));
        if (days <= 0 && seconds <= 0 && minutes <= 0 && hours <= 0) {
            await handleTopicEnd(TopicId)
            topic.isActive = false;
        }

        const formattedTopic = {
            _id: topic._id,
            title: topic.title,
            description: topic.description,
            deadline: topic.deadline,
            owner: {
                id: topic.owner._id,
                username: topic.owner.username
            },
            isActive: topic.isActive,
            answers: topic.answers.map(answer => ({
                text: answer.text,
                user: {
                    id: answer.user._id,
                    username: answer.user.username,
                    image: answer.user.image
                }
            })),
            bestAnswer: topic.bestAnswer ? topic.bestAnswer : null
        };

        res.status(200).json({ topic: formattedTopic });
    } catch (error) {
        console.error('Error fetching topic by ID:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};




const addAnswer = asyncWrapper(
    async (req, res, next) => {
        const topicId = req.params.id;
        const { text } = req.body;
        const userId = req.currentUser.id;

        const topic = await Topic.findById(topicId);
        if (!topic) {
            return res.status(404).json({ message: 'topic not found' });
        }

        const newAnswer = {
            text: text,
            user: userId
        };
        topic.answers.push(newAnswer);

        await topic.save();

        res.status(201).json({ message: 'Answer added successfully', answer: newAnswer, topic });
    }
);


module.exports = {
    createTopic,
    getAllTopics,
    getTopicById,
    addAnswer,
};