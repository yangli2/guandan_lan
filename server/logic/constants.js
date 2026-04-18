const SUITS = ['H', 'D', 'C', 'S']; // Hearts, Diamonds, Clubs, Spades
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const JOKERS = ['SJ', 'BJ']; // Small Joker, Big Joker

const COMBO_TYPES = {
    SINGLE: 'SINGLE',
    PAIR: 'PAIR',
    TRIPLE: 'TRIPLE',
    FULL_HOUSE: 'FULL_HOUSE',
    STRAIGHT: 'STRAIGHT',
    TUBE: 'TUBE',
    PLATE: 'PLATE',
    BOMB: 'BOMB',
    STRAIGHT_FLUSH: 'STRAIGHT_FLUSH',
    FOUR_JOKERS: 'FOUR_JOKERS'
};

module.exports = {
    SUITS,
    RANKS,
    JOKERS,
    COMBO_TYPES
};
