const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
});

const contestsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    deadline: {
        type: Date,
        required: true,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    answers: [answerSchema],
    bestAnswer: {
        type: String,
    }
});

module.exports = mongoose.model("Contest", contestsSchema);
