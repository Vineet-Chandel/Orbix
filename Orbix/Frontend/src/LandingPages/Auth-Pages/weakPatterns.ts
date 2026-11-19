// Synchronized with Backend/src/validators/SignupValidator.ts
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

    // CALENDAR
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december', 'monday', 'tuesday', 'wednesday',
    'thursday', 'friday', 'saturday', 'sunday',
    'january123', 'february123', 'march123', 'april123', 'may123', 'june123',
    'july123', 'august123', 'september123', 'october123', 'november123', 'december123',
    'monday123', 'tuesday123', 'wednesday123', 'thursday123', 'friday123', 'saturday123',
    'sunday123',

    // LOVE / EMOTIONAL
    'iloveyou', 'iloveu', 'iloveyou123', 'iloveyou1', 'loveyou', 'loveme', 'love123',
    'love1234', 'lovely', 'forever', 'forever123', 'trustno1', 'trustme', 'missyou',
    'missme', 'beautiful', 'beautiful123', 'sunshine', 'sunshine123', 'freedom',
    'whatever', 'princess', 'princess123', 'secret', 'secret123',

    // ANIMALS
    'dog', 'dog123', 'doggy', 'doggy123', 'cat', 'cat123', 'kitty', 'kitty123',
    'tiger', 'tiger123', 'lion', 'lion123', 'monkey', 'monkey123', 'dragon', 'dragon123',
    'shadow', 'shadow123', 'wolf', 'wolf123', 'bear', 'bear123', 'eagle', 'eagle123',
    'horse', 'horse123', 'rabbit', 'rabbit123',

    // POP CULTURE
    'avatar', 'avatar123', 'batman', 'batman123', 'superman', 'superman123',
    'spiderman', 'spiderman123', 'ironman', 'ironman123', 'harrypotter', 'harrypotter123',
    'pokemon', 'pokemon123', 'naruto', 'naruto123', 'dragonball', 'dragonball123',
    'starwars', 'starwars123',

    // SPORTS
    'football', 'football123', 'cricket', 'cricket123', 'soccer', 'soccer123',
    'basketball', 'basketball123', 'baseball', 'baseball123', 'tennis', 'tennis123',
    'champion', 'champion123', 'winner', 'winner123',

    // COMMON WORDS
    'hello', 'hello123', 'helloworld', 'helloworld123', 'welcome', 'secret', 'access',
    'access123', 'master', 'master123', 'nothing', 'nothing123', 'whatever', 'whatever123',
    'freedom', 'freedom123', 'computer', 'computer123', 'internet', 'internet123',
    'technology', 'technology123', 'developer', 'developer123', 'coding', 'coding123',
    'programmer', 'programmer123',

    // POPULAR DUMB PASSWORDS
    'fuckyou', 'fuckyou123', 'whatever', 'whatever1', 'nothing', 'nothing1',
    'nopassword', 'noidea', 'unknown', 'unknown123',

    // COMMON COMBOS
    'admin@123', 'admin@1234', 'admin#123', 'admin#1234', 'admin!123', 'user@123',
    'user#123', 'root@123', 'root#123', 'welcome@123', 'welcome#123', 'test@123',
    'test#123', 'guest@123', 'guest#123', 'qwerty@123', 'qwerty#123', 'abc@123',
    'abc#123', 'abc123', 'abc1234', 'abc12345',

    // INDIA-COMMON
    'india', 'india123', 'india1234', 'india@123', 'hindustan', 'bharat', 'bharat123',
    'bharat@123', 'namaste', 'namaste123', 'delhi', 'delhi123', 'mumbai', 'mumbai123',
    'kanpur', 'kanpur123',

    // BASIC PHONE PATTERNS
    '9876543210', '0123456789', '1234567890', '9999999999', '8888888888',
    '7777777777', '6666666666', '5555555555', '4444444444', '3333333333',
    '2222222222', '1111111111', '0000000000'
];

export function hasWeakPattern(password: string): boolean {
    if (!password) return false;
    const lower = password.toLowerCase();
    return weakPatterns.some((pattern) => lower.includes(pattern.toLowerCase()));
}
