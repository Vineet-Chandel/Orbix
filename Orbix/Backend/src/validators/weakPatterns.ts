// Synchronized with Frontend/src/LandingPages/Auth-Pages/weakPatterns.ts
export const weakPatterns: string[] = [
    // NUMERIC SEQUENCES
    '123', '1234', '12345', '123456', '1234567', '12345678', '123456789', '1234567890',
    '012345', '01234567', '0123456789', '987654', '987654321', '9876543210', '87654321',
    '7654321', '654321', '543210', '234567', '345678', '456789', '567890', '112233',
    '123123', '123321', '321123', '121212', '111111', '222222', '333333', '444444',
    '555555', '666666', '777777', '888888', '999999', '000000',

    // COMMON PASSWORDS
    'password', 'password1', 'password12', 'password123', 'password1234', 'password12345',
    'password@123', 'password#123', 'password1!', 'password@1', 'pass123', 'pass1234',
    'pass12345', 'passw0rd', 'passw0rd123', 'p@ssword', 'p@ssword1', 'p@ssword123',
    'p@ssw0rd', 'p@ssw0rd1', 'p@ssw0rd123', 'P@ssword', 'P@ssword1', 'P@ssword123',
    'P@ssw0rd', 'P@ssw0rd1', 'P@ssw0rd123', 'Password', 'Password1', 'Password123',
    'PASSWORD', 'PASSWORD1', 'PASSWORD123',

    // DEFAULT / SYSTEM PASSWORDS
    'admin', 'admin1', 'admin123', 'admin1234', 'admin@123', 'admin#123', 'administrator',
    'administrator123', 'root', 'root123', 'root1234', 'toor', 'guest', 'guest123',
    'user', 'user123', 'test', 'test123', 'test1234', 'demo', 'demo123', 'default',
    'default123', 'changeme', 'changeme123', 'welcome', 'welcome1', 'welcome123',
    'welcome@123', 'letmein', 'letmein123', 'login', 'login123', 'system', 'system123',
    'support', 'support123', 'manager', 'manager123', 'superuser', 'superadmin',

    // KEYBOARD PATTERNS
    'qwerty', 'qwertyui', 'qwertyuiop', 'qwerty123', 'qwerty1', 'qwerty12', 'qwerty@123',
    'asdf', 'asdfgh', 'asdfghj', 'asdfghjk', 'asdfghjkl', 'asdf123', 'zxcv', 'zxcvb',
    'zxcvbn', 'zxcvbnm', 'zxcv123', 'qazwsx', 'qazwsxedc', 'zaqwsx', 'zaq12wsx',
    '1qaz', '1qaz2wsx', '1q2w3e', '1q2w3e4r', '2wsx', '3edc', '4rfv', '5tgb',
    '6yhn', '7ujm', 'poiuyt', 'poiuytrewq', 'lkjhg', 'lkjhgfdsa', 'mnbvc', 'mnbvcxz',

    // ALPHABETIC SEQUENCES
    'abc', 'abcd', 'abcde', 'abcdef', 'abcdefg', 'abcdefgh', 'abcdefghi', 'abcdefghij',
    'zyx', 'zyxw', 'zyxwv', 'zyxwvuts', 'zyxwvutsrq', 'abcdefghijklmnopqrstuvwxyz',
    'zyxwvutsrqponmlkjihgfedcba',

    // REPETITION
    'aaa', 'aaaa', 'aaaaa', 'aaaaaa', 'aaaaaaa', 'aaaaaaaa', 'bbbbbb', 'cccccc',
    'dddddd', 'eeeeee', 'ffffff', 'gggggg', 'hhhhhh', 'iiiiii', 'jjjjjj', 'kkkkkk',
    'llllll', 'mmmmmm', 'nnnnnn', 'oooooo', 'pppppp', 'qqqqqq', 'rrrrrr', 'ssssss',
    'tttttt', 'uuuuuu', 'vvvvvv', 'wwwwww', 'xxxxxx', 'yyyyyy', 'zzzzzz',

    // REPEATED BLOCKS
    '121212', '12121212', '123123', '123123123', '12341234', 'ababab', 'abababab',
    'abcabc', 'abcabcabc', 'xyzxyz', 'xyzxyzxyz', 'qweqwe', 'qweqweqwe', 'asdfasdf',
    'asdfasdfasdf',

    // CALENDAR / MONTHS
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'spring', 'summer', 'autumn', 'winter',

    // COMMON ORBIX/DEV STRINGS
    'orbix', 'orbix123', 'orbix@123', 'developer', 'developer123', 'coding', 'coding123'
];

export function hasWeakPattern(password: string): boolean {
    if (!password) return false;
    const lower = password.toLowerCase();
    return weakPatterns.some((pattern) => lower.includes(pattern));
}
