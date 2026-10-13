
const weakPatterns = [
    // ============================================================
    // NUMERIC SEQUENCES
    // ============================================================
    '123',
    '1234',
    '12345',
    '123456',
    '1234567',
    '12345678',
    '123456789',
    '1234567890',
    '012345',
    '01234567',
    '0123456789',
    '987654',
    '987654321',
    '9876543210',
    '87654321',
    '7654321',
    '654321',
    '543210',
    '234567',
    '345678',
    '456789',
    '567890',
    '112233',
    '123123',
    '123321',
    '321123',
    '121212',
    '111111',
    '222222',
    '333333',
    '444444',
    '555555',
    '666666',
    '777777',
    '888888',
    '999999',
    '000000',

    // ============================================================
    // COMMON PASSWORDS
    // ============================================================
    'password',
    'password1',
    'password12',
    'password123',
    'password1234',
    'password12345',
    'password@123',
    'password#123',
    'password1!',
    'password@1',
    'pass123',
    'pass1234',
    'pass12345',
    'passw0rd',
    'passw0rd123',
    'p@ssword',
    'p@ssword1',
    'p@ssword123',
    'p@ssw0rd',
    'p@ssw0rd1',
    'p@ssw0rd123',
    'P@ssword',
    'P@ssword1',
    'P@ssword123',
    'P@ssw0rd',
    'P@ssw0rd1',
    'P@ssw0rd123',
    'Password',
    'Password1',
    'Password123',
    'PASSWORD',
    'PASSWORD1',
    'PASSWORD123',

    // ============================================================
    // DEFAULT / SYSTEM PASSWORDS
    // ============================================================
    'admin',
    'admin1',
    'admin123',
    'admin1234',
    'admin@123',
    'admin#123',
    'administrator',
    'administrator123',
    'root',
    'root123',
    'root1234',
    'toor',
    'guest',
    'guest123',
    'user',
    'user123',
    'test',
    'test123',
    'test1234',
    'demo',
    'demo123',
    'default',
    'default123',
    'changeme',
    'changeme123',
    'welcome',
    'welcome1',
    'welcome123',
    'welcome@123',
    'letmein',
    'letmein123',
    'login',
    'login123',
    'system',
    'system123',
    'support',
    'support123',
    'manager',
    'manager123',
    'superuser',
    'superadmin',

    // ============================================================
    // KEYBOARD PATTERNS
    // ============================================================
    'qwerty',
    'qwertyui',
    'qwertyuiop',
    'qwerty123',
    'qwerty1',
    'qwerty12',
    'qwerty@123',
    'asdf',
    'asdfgh',
    'asdfghj',
    'asdfghjk',
    'asdfghjkl',
    'asdf123',
    'zxcv',
    'zxcvb',
    'zxcvbn',
    'zxcvbnm',
    'zxcv123',
    'qazwsx',
    'qazwsxedc',
    'zaqwsx',
    'zaq12wsx',
    '1qaz',
    '1qaz2wsx',
    '1q2w3e',
    '1q2w3e4r',
    '2wsx',
    '3edc',
    '4rfv',
    '5tgb',
    '6yhn',
    '7ujm',
    'poiuyt',
    'poiuytrewq',
    'lkjhg',
    'lkjhgfdsa',
    'mnbvc',
    'mnbvcxz',

    // ============================================================
    // ALPHABETIC SEQUENCES
    // ============================================================
    'abc',
    'abcd',
    'abcde',
    'abcdef',
    'abcdefg',
    'abcdefgh',
    'abcdefghi',
    'abcdefghij',
    'zyx',
    'zyxw',
    'zyxwv',
    'zyxwvuts',
    'zyxwvutsrq',
    'abcdefghijklmnopqrstuvwxyz',
    'zyxwvutsrqponmlkjihgfedcba',

    // ============================================================
    // REPETITION
    // ============================================================
    'aaa',
    'aaaa',
    'aaaaa',
    'aaaaaa',
    'aaaaaaa',
    'aaaaaaaa',
    'bbbbbb',
    'cccccc',
    'dddddd',
    'eeeeee',
    'ffffff',
    'gggggg',
    'hhhhhh',
    'iiiiii',
    'jjjjjj',
    'kkkkkk',
    'llllll',
    'mmmmmm',
    'nnnnnn',
    'oooooo',
    'pppppp',
    'qqqqqq',
    'rrrrrr',
    'ssssss',
    'tttttt',
    'uuuuuu',
    'vvvvvv',
    'wwwwww',
    'xxxxxx',
    'yyyyyy',
    'zzzzzz',

    // ============================================================
    // REPEATED BLOCKS
    // ============================================================
    '121212',
    '12121212',
    '123123',
    '123123123',
    '12341234',
    'ababab',
    'abababab',
    'abcabc',
    'abcabcabc',
    'xyzxyz',
    'xyzxyzxyz',
    'qweqwe',
    'qweqweqwe',
    'asdfasdf',
    'asdfasdfasdf',

    // ============================================================
    // CALENDAR
    // ============================================================
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',

    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',

    // ============================================================
    // MONTH / DAY VARIANTS
    // ============================================================
    'january123',
    'february123',
    'march123',
    'april123',
    'may123',
    'june123',
    'july123',
    'august123',
    'september123',
    'october123',
    'november123',
    'december123',

    'monday123',
    'tuesday123',
    'wednesday123',
    'thursday123',
    'friday123',
    'saturday123',
    'sunday123',

    // ============================================================
    // LOVE / EMOTIONAL
    // ============================================================
    'iloveyou',
    'iloveu',
    'iloveyou123',
    'iloveyou1',
    'loveyou',
    'loveme',
    'love123',
    'love1234',
    'lovely',
    'forever',
    'forever123',
    'trustno1',
    'trustme',
    'missyou',
    'missme',
    'beautiful',
    'beautiful123',
    'sunshine',
    'sunshine123',
    'freedom',
    'whatever',
    'princess',
    'princess123',
    'secret',
    'secret123',

    // ============================================================
    // ANIMALS
    // ============================================================
    'dog',
    'dog123',
    'doggy',
    'doggy123',
    'cat',
    'cat123',
    'kitty',
    'kitty123',
    'tiger',
    'tiger123',
    'lion',
    'lion123',
    'monkey',
    'monkey123',
    'dragon',
    'dragon123',
    'shadow',
    'shadow123',
    'wolf',
    'wolf123',
    'bear',
    'bear123',
    'eagle',
    'eagle123',
    'horse',
    'horse123',
    'rabbit',
    'rabbit123',

    // ============================================================
    // POP CULTURE
    // ============================================================
    'avatar',
    'avatar123',
    'batman',
    'batman123',
    'superman',
    'superman123',
    'spiderman',
    'spiderman123',
    'ironman',
    'ironman123',
    'harrypotter',
    'harrypotter123',
    'pokemon',
    'pokemon123',
    'naruto',
    'naruto123',
    'dragonball',
    'dragonball123',
    'starwars',
    'starwars123',

    // ============================================================
    // SPORTS
    // ============================================================
    'football',
    'football123',
    'cricket',
    'cricket123',
    'soccer',
    'soccer123',
    'basketball',
    'basketball123',
    'baseball',
    'baseball123',
    'tennis',
    'tennis123',
    'champion',
    'champion123',
    'winner',
    'winner123',

    // ============================================================
    // COMMON WORDS
    // ============================================================
    'hello',
    'hello123',
    'helloworld',
    'helloworld123',
    'welcome',
    'secret',
    'access',
    'access123',
    'master',
    'master123',
    'nothing',
    'nothing123',
    'whatever',
    'whatever123',
    'freedom',
    'freedom123',
    'computer',
    'computer123',
    'internet',
    'internet123',
    'technology',
    'technology123',
    'developer',
    'developer123',
    'coding',
    'coding123',
    'programmer',
    'programmer123',

    // ============================================================
    // POPULAR DUMB PASSWORDS
    // ============================================================
    '123456789',
    '12345678',
    '1234567',
    '123456',
    '12345',
    '1234',
    '123',
    '000000',
    '111111',
    '11111111',
    '222222',
    '333333',
    '444444',
    '555555',
    '666666',
    '777777',
    '888888',
    '999999',

    'fuckyou',
    'fuckyou123',
    'whatever',
    'whatever1',
    'nothing',
    'nothing1',
    'nopassword',
    'noidea',
    'unknown',
    'unknown123',

    // ============================================================
    // COMMON COMBOS
    // ============================================================
    'admin@123',
    'admin@1234',
    'admin#123',
    'admin#1234',
    'admin!123',
    'user@123',
    'user#123',
    'root@123',
    'root#123',
    'welcome@123',
    'welcome#123',
    'test@123',
    'test#123',
    'guest@123',
    'guest#123',
    'qwerty@123',
    'qwerty#123',
    'abc@123',
    'abc#123',
    'abc123',
    'abc1234',
    'abc12345',

    // ============================================================
    // INDIA-COMMON PASSWORD PATTERNS
    // ============================================================
    'india',
    'india123',
    'india1234',
    'india@123',
    'hindustan',
    'bharat',
    'bharat123',
    'bharat@123',
    'namaste',
    'namaste123',
    'delhi',
    'delhi123',
    'mumbai',
    'mumbai123',
    'kanpur',
    'kanpur123',

    // ============================================================
    // BASIC PHONE-LIKE PATTERNS
    // ============================================================
    '9876543210',
    '0123456789',
    '1234567890',
    '9999999999',
    '8888888888',
    '7777777777',
    '6666666666',
    '5555555555',
    '4444444444',
    '3333333333',
    '2222222222',
    '1111111111',
    '0000000000',
];

import validator from "validator";

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

const SignupValidator = (data: any) => {
    // 1. Strict Type & Presence Checking
    if (typeof data.firstName !== "string" ||
        typeof data.lastName !== "string" ||
        typeof data.gmail !== "string" ||
        typeof data.username !== "string" ||
        typeof data.password !== "string") {
        throw new ValidationError("All fields must be valid strings.");
    }

    if (data.middleName !== undefined && data.middleName !== null && typeof data.middleName !== "string") {
        throw new ValidationError("Middle name must be a string if provided.");
    }

    if (typeof data.termsAccepted !== "boolean") {
        throw new ValidationError("Terms accepted must be a boolean.");
    }

    if (data.termsAccepted !== true) {
        throw new ValidationError("You must accept the terms and conditions.");
    }

    // 2. Max Length & DoS Protection
    if (data.password.length > 128) throw new ValidationError("Password is too long.");
    if (data.firstName.length > 50 || data.lastName.length > 50) throw new ValidationError("Name is too long.");
    if (data.gmail.length > 255) throw new ValidationError("Email is too long.");
    if (data.username.length > 50) throw new ValidationError("Username is too long.");

    // 3. Normalization (Safe)
    const normalizedFirstName = data.firstName.trim();
    const normalizedMiddleName = data.middleName ? data.middleName.trim() : null;
    const normalizedLastName = data.lastName.trim();
    const normalizedGmail = data.gmail.trim().toLowerCase();
    const normalizedUsername = data.username.trim().toLowerCase();
    const password = data.password; // Do NOT trim or remove spaces from passwords

    // 4. Emptiness Checks
    if (!normalizedFirstName || !normalizedLastName || !normalizedGmail || !normalizedUsername || !password) {
        throw new ValidationError("Fields cannot be empty.");
    }

    if (normalizedFirstName.length < 2 || normalizedLastName.length < 2) {
        throw new ValidationError("First and last names must be at least 2 characters.");
    }

    // 5. Format Validation
    if (!validator.isEmail(normalizedGmail)) {
        throw new ValidationError("Email is not valid.");
    }

    if (!validator.matches(normalizedUsername, /^[a-z0-9._-]{3,20}$/)) {
        throw new ValidationError("Username must be 3-20 characters, containing only lowercase letters, numbers, dots, underscores, or hyphens.");
    }

    if (!validator.isStrongPassword(password)) {
        throw new ValidationError("Please enter a stronger password.");
    }

    if (weakPatterns.some((item) => password.toLowerCase().includes(item.toLowerCase()))) {
        throw new ValidationError("Password contains a common weak pattern.");
    }

    return {
        firstName: normalizedFirstName,
        middleName: normalizedMiddleName,
        lastName: normalizedLastName,
        gmail: normalizedGmail,
        password: password, // preserved exactly
        username: normalizedUsername,
        termsAccepted: data.termsAccepted
    };
};

export default SignupValidator;