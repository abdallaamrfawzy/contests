const Contest = require("../../models/Contests.js");
const cron = require('node-cron');
const { parseISO, format } = require('date-fns');
const asyncWrapper = require("../../utils/asyncWrapper");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const createContest = asyncWrapper(async (req, res, next) => {
    const { title, description, deadline } = req.body;

    if (!title || !description || !deadline) {
        return next(appError.create("All fields are required", 400, "FAIL"));
    }
    const userId = req.currentUser.id;

    const newContest = new Contest({
        title,
        description,
        deadline: new Date(deadline),
        owner: userId,
        isActive: new Date() < new Date(deadline),
    });

    try {
        await newContest.save();

        const deadlineDate = parseISO(deadline);
        const cronPattern = format(deadlineDate, 's m H d M *');

        const task = cron.schedule(cronPattern, async () => {
            await handleContestEnd(newContest._id);
        });
        task.start();
        return res.status(201).json({ status: "Success", data: { contest: newContest } });
    } catch (error) {
        console.error("Error creating contest:", error);
        return next(appError.create("Error creating contest", 500, "FAIL"));
    }
});

async function handleContestEnd(contestId) {
    try {
        const contest = await Contest.findById(contestId).populate('answers.user', 'username image');

        if (!contest) {
            console.error(`Contest with ID ${contestId} not found`);
            return;
        }

        const prompt = `a question: ${contest.title}. Analyze these answers and give the best answer: ${contest.answers.map(answer => answer.text).join(", ")}. This is a competition and I want to announce the best answer and respond with the answer only`;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const bestAnswer = response.text();

        console.log(`Best answer for contest ${contest.title}: ${bestAnswer}`);
        contest.isActive = false;
        await contest.save();
        contest.bestAnswer = bestAnswer;
        await contest.save();

    } catch (error) {
        console.error(`Error handling contest end for contest ID ${contestId}:`, error);
    }
}

const getAllContests = asyncWrapper(async (req, res, next) => {
    const contests = await Contest.find()
        .populate('owner', 'username')
        .populate('answers.user', 'username image');

    const formattedContests = contests.map(contest => {
        const formattedAnswers = contest.answers.map(answer => ({
            text: answer.text,
            user: {
                id: answer.user._id,
                username: answer.user.username,
                image: answer.user.image
            }
        }));

        return {
            _id: contest._id,
            title: contest.title,
            description: contest.description,
            deadline: contest.deadline,
            owner: {
                id: contest.owner._id,
                username: contest.owner.username
            },
            isActive: contest.isActive,
            answers: formattedAnswers
        };
    });

    res.status(200).json({ status: "Success", data: { contests: formattedContests } });
});


const getContestById = async (req, res, next) => {
    const contestId = req.params.id;

    try {
        const contest = await Contest.findById(contestId)
            .populate('owner', 'username')
            .populate({
                path: 'answers.user',
                select: 'username image'
            });

        if (!contest) {
            return res.status(404).json({ message: 'Contest not found' });
        }
        const total = Date.parse(contest.deadline) - Date.parse(new Date());
        const seconds = Math.floor((total / 1000) % 60);
        const minutes = Math.floor((total / 1000 / 60) % 60);
        const hours = Math.floor((total / 1000 / 60 / 60) % 24);
        const days = Math.floor(total / (1000 * 60 * 60 * 24));
        if (days <= 0 && seconds <= 0 && minutes <= 0 && hours <= 0) {
            await handleContestEnd(contestId)
            contest.isActive = false;
        }
        let bestAnswer = null;
        let similarAnswer = null;

        if (contest.bestAnswer) {
            const bestAnswerText = contest.bestAnswer.toLowerCase();

            let maxSimilarity = 0;

            contest.answers.forEach(answer => {
                const currentAnswerText = answer.text.toLowerCase();
                const similarity = calculateSimilarity(bestAnswerText, currentAnswerText);

                if (similarity > maxSimilarity) {
                    maxSimilarity = similarity;
                    similarAnswer = {
                        text: answer.text,
                        user: {
                            id: answer.user._id,
                            username: answer.user.username,
                            image: answer.user.image
                        }
                    };
                }
            });
        }

        const formattedContest = {
            _id: contest._id,
            title: contest.title,
            description: contest.description,
            deadline: contest.deadline,
            owner: {
                id: contest.owner._id,
                username: contest.owner.username
            },
            isActive: contest.isActive,
            answers: contest.answers.map(answer => ({
                text: answer.text,
                user: {
                    id: answer.user._id,
                    username: answer.user.username,
                    image: answer.user.image
                }
            })),
            bestAnswer: contest.bestAnswer ? contest.bestAnswer : null,
            similarAnswer: similarAnswer || null
        };

        res.status(200).json({ contest: formattedContest });
    } catch (error) {
        console.error('Error fetching contest by ID:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

function calculateSimilarity(text1, text2) {
    const similarity = similarText(text1, text2);
    return similarity / Math.max(text1.length, text2.length);
}

function similarText(first, second) {
    let pos1 = 0, pos2 = 0;
    let max = 0;

    for (let p = 0; p < first.length; p++) {
        for (let q = 0; q < second.length; q++) {
            let l = 0;
            while (p + l < first.length && q + l < second.length && first[p + l] === second[q + l]) {
                l++;
            }
            if (l > max) {
                max = l;
                pos1 = p;
                pos2 = q;
            }
        }
    }

    let sum = max;

    if (sum) {
        if (pos1 && pos2) {
            sum += similarText(first.substr(0, pos1), second.substr(0, pos2));
        }

        if ((pos1 + max < first.length) && (pos2 + max < second.length)) {
            sum += similarText(first.substr(pos1 + max, first.length - pos1 - max), second.substr(pos2 + max, second.length - pos2 - max));
        }
    }

    return sum;
}






const addAnswer = asyncWrapper(
    async (req, res, next) => {
        const contestId = req.params.id;
        const { text } = req.body;
        const userId = req.currentUser.id;

        const contest = await Contest.findById(contestId);
        if (!contest) {
            return res.status(404).json({ message: 'Contest not found' });
        }

        const newAnswer = {
            text: text,
            user: userId
        };
        contest.answers.push(newAnswer);

        await contest.save();

        res.status(201).json({ message: 'Answer added successfully', answer: newAnswer, contest });
    }
);


module.exports = {
    createContest,
    getAllContests,
    getContestById,
    addAnswer,
};