Date.prototype.formatDate = function (input,time) {
    // formatDate :
    // a PHP date like function, for formatting date strings
    // See: http://www.php.net/date
    //
    // input : format string
    // time : epoch time (seconds, and optional)
    //
    // if time is not passed, formatting is based on 
    // the current "this" date object's set time.
    //
    // supported:
    // a, A, B, d, D, F, g, G, h, H, i, j, l (lowercase L), L, 
    // m, M, n, O, r, s, S, t, U, w, W, y, Y, z
    //
    // unsupported:
    // I (capital i), T, Z    

    var daysLong =    ["Sunday", "Monday", "Tuesday", "Wednesday", 
                       "Thursday", "Friday", "Saturday"];
    var daysShort =   ["Sun", "Mon", "Tue", "Wed", 
                       "Thu", "Fri", "Sat"];
    var monthsShort = ["Jan", "Feb", "Mar", "Apr",
                       "May", "Jun", "Jul", "Aug", "Sep",
                       "Oct", "Nov", "Dec"];
    var monthsLong =  ["January", "February", "March", "April",
                       "May", "June", "July", "August", "September",
                       "October", "November", "December"];
    var daysSuffix = ["st", "nd", "rd", "th", "th", "th", "th", // 1st - 7th
                      "th", "th", "th", "th", "th", "th", "th", // 8th - 14th
                      "th", "th", "th", "th", "th", "th", "st", // 15th - 21st
                      "nd", "rd", "th", "th", "th", "th", "th", // 22nd - 28th
                      "th", "th", "st"];                        // 29th - 31st
    var formatters = {
        a() {
            // Lowercase Ante meridiem and Post meridiem
            return self.getHours() > 11? "pm" : "am";
        },
        A() {
            // Uppercase Ante meridiem and Post meridiem
            return self.getHours() > 11? "PM" : "AM";
        },

        B(){
            // Swatch internet time. code simply grabbed from ppk,
            // since I was feeling lazy:
            // http://www.xs4all.nl/~ppk/js/beat.html
            var off = (self.getTimezoneOffset() + 60)*60;
            var theSeconds = (self.getHours() * 3600) + 
                            (self.getMinutes() * 60) + 
                            self.getSeconds() + off;
            var beat = Math.floor(theSeconds/86.4);
            if (beat > 1000) beat -= 1000;
            if (beat < 0) beat += 1000;
            if ((""+beat).length == 1) beat = "00"+beat;
            if ((""+beat).length == 2) beat = "0"+beat;
            return beat;
        },
        
        d() {
            // Day of the month, 2 digits with leading zeros
            return String(self.getDate()).length == 1?
            "0"+self.getDate() : self.getDate();
        },

        D() {
            // A textual representation of a day, three letters
            return daysShort[self.getDay()];
        },

        F() {
            // A full textual representation of a month
            return monthsLong[self.getMonth()];
        },

        g() {
            // 12-hour format of an hour without leading zeros
            return self.getHours() > 12? self.getHours()-12 : self.getHours();
        },

        G() {
            // 24-hour format of an hour without leading zeros
            return self.getHours();
        },

        h() {
            // 12-hour format of an hour with leading zeros
            if (self.getHours() > 12) {
            var s = String(self.getHours()-12);
            return s.length == 1?
            "0"+ (self.getHours()-12) : self.getHours()-12;
            } else { 
            var s = String(self.getHours());
            return s.length == 1?
            "0"+self.getHours() : self.getHours();
            }
        },

        H() {
            // 24-hour format of an hour with leading zeros
            return String(self.getHours()).length == 1?
            "0"+self.getHours() : self.getHours();
        },

        i() {
            // Minutes with leading zeros
            return String(self.getMinutes()).length == 1? 
            "0"+self.getMinutes() : self.getMinutes(); 
        },

        j() {
            // Day of the month without leading zeros
            return self.getDate();
        },

        l() {
            // A full textual representation of the day of the week
            return daysLong[self.getDay()];
        },

        L() {
            // leap year or not. 1 if leap year, 0 if not.
            // the logic should match iso's 8601 standard.
            var y_ = formatters.Y();
            if (         
                (y_ % 4 == 0 && y_ % 100 != 0) ||
                (y_ % 4 == 0 && y_ % 100 == 0 && y_ % 400 == 0)
                ) {
                return 1;
            } else {
                return 0;
            }
        },

        m() {
            // Numeric representation of a month, with leading zeros
            return self.getMonth() < 9?
            "0"+(self.getMonth()+1) : 
            self.getMonth()+1;
        },

        M() {
            // A short textual representation of a month, three letters
            return monthsShort[self.getMonth()];
        },

        n() {
            // Numeric representation of a month, without leading zeros
            return self.getMonth()+1;
        },

        O() {
            // Difference to Greenwich time (GMT) in hours
            var os = Math.abs(self.getTimezoneOffset());
            var h = ""+Math.floor(os/60);
            var m = ""+(os%60);
            h.length == 1? h = "0"+h:1;
            m.length == 1? m = "0"+m:1;
            return self.getTimezoneOffset() < 0 ? "+"+h+m : "-"+h+m;
        },

        r() {
            // RFC 822 formatted date
            var r; // result
            //  Thu    ,     21          Dec         2000
            r = formatters.D() + ", " + formatters.j() + " " + formatters.M() + " " + formatters.Y() +
            //        16     :    01     :    07          +0200
                " " + formatters.H() + ":" + formatters.i() + ":" + formatters.s() + " " + formatters.O();
            return r;
        },

        S() {
            // English ordinal suffix for the day of the month, 2 characters
            return daysSuffix[self.getDate()-1];
        },

        s() {
            // Seconds, with leading zeros
            return String(self.getSeconds()).length == 1?
            "0"+self.getSeconds() : self.getSeconds();
        },

        t() {
            // thanks to Matt Bannon for some much needed code-fixes here!
            var daysinmonths = [null,31,28,31,30,31,30,31,31,30,31,30,31];
            if (formatters.L()==1 && n()==2) return 29; // leap day
            return daysinmonths[n()];
        },

        U() {
            // Seconds since the Unix Epoch (January 1 1970 00:00:00 GMT)
            return Math.round(self.getTime()/1000);
        },

        W() {
            // Weeknumber, as per ISO specification:
            // http://www.cl.cam.ac.uk/~mgk25/iso-time.html
            
            // if the day is three days before newyears eve,
            // there's a chance it's "week 1" of next year.
            // here we check for that.
            var beforeNY = 364 + formatters.L() - formatters.z();
            var afterNY  = formatters.z();
            var weekday = formatters.w() !=0 ? formatters.w()-1 : 6; // makes sunday (0), into 6.
            if (beforeNY <= 2 && weekday <= 2-beforeNY) {
                return 1;
            }
            // similarly, if the day is within threedays of newyears
            // there's a chance it belongs in the old year.
            var ny = new Date("January 1 " + Y() + " 00:00:00");
            var nyDay = ny.getDay()!=0?ny.getDay()-1:6;
            if (
                (afterNY <= 2) && 
                (nyDay >=4)  && 
                (afterNY >= (6-nyDay))
                ) {
                // Since I'm not sure we can just always return 53,
                // i call the function here again, using the last day
                // of the previous year, as the date, and then just
                // return that week.
                var prevNY = new Date("December 31 " + (formatters.Y()-1) + " 00:00:00");
                return prevNY.formatDate("W");
            }
            
            // week 1, is the week that has the first thursday in it.
            // note that this value is not zero index.
            if (nyDay <= 3) {
                // first day of the year fell on a thursday, or earlier.
                return 1 + Math.floor((formatters.z() + nyDay ) / 7 );
            } else {
                // first day of the year fell on a friday, or later.
                return 1 + Math.floor((formatters.z() - ( 7 - nyDay ) ) / 7 );
            }
        },

        w() {
            // Numeric representation of the day of the week
            return self.getDay();
        },
        
        Y() {
            // A full numeric representation of a year, 4 digits

            // we first check, if getFullYear is supported. if it
            // is, we just use that. ppks code is nice, but wont
            // work with dates outside 1900-2038, or something like that
            if (self.getFullYear) {
                var newDate = new Date("January 1 2001 00:00:00 +0000");
                var x = newDate .getFullYear();
                if (x == 2001) {              
                    // i trust the method now
                    return self.getFullYear();
                }
            }
            // else, do this:
            // codes thanks to ppk:
            // http://www.xs4all.nl/~ppk/js/introdate.html
            var x = self.getYear();
            var y = x % 100;
            y += (y < 38) ? 2000 : 1900;
            return y;
        },

        y() {
            // A two-digit representation of a year
            var y = formatters.Y()+"";
            return y.substring(y.length-2,y.length);
        },

        z() {
            // The day of the year, zero indexed! 0 through 366
            var t = new Date("January 1 " + Y() + " 00:00:00");
            var diff = self.getTime() - t.getTime();
            return Math.floor(diff/1000/60/60/24);
        },
    };
        
    var self = this;
    if (time) {
        // save time
        var prevTime = self.getTime();
        self.setTime(time);
    }
    
    var ia = input.split("");
    var ij = 0;
    while (ia[ij]) {
        if (ia[ij] == "\\") {
            // this is our way of allowing users to escape stuff
            ia.splice(ij,1);
        } else {
            var formatter = formatters[ia[ij]];
            if (formatter) {
                ia[ij] = formatter();
            }
        }
        ij++;
    }
    // reset time, back to what it was
    if (prevTime) {
        self.setTime(prevTime);
    }
    return ia.join("");
}

function run() {
    var date = new Date("1/1/2007 1:11:11");
    var resultHash = 0x1a2b3c4d;

    for (i = 0; i < 500; ++i) {
        var shortFormat = date.formatDate("Y-m-d");
        var longFormat = date.formatDate("l, F d, Y g:i:s A");
        date.setTime(date.getTime() + 84266956);
        // Assuming only ascii output.
        resultHash ^= shortFormat.charCodeAt(6) | shortFormat.charCodeAt(8) << 8;
        resultHash ^= longFormat.charCodeAt(10) << 16 | longFormat.charCodeAt(11) << 24;
    }

    // FIXME: Find a way to validate this test.
    // https://bugs.webkit.org/show_bug.cgi?id=114849
    return resultHash;
}


class Benchmark {
    EXPECTED_RESULT_HASH = 439041101;

    runIteration() {
        this.resultHash = 0x1a2b3c4d;
        for (let i = 0; i < 8; ++i)
            this.resultHash ^= run();
    }

    validate() {
        if (this.resultHash != this.EXPECTED_RESULT_HASH)
            throw new Error(`Got unexpected result hash ${this.resultHash} instead of ${this.EXPECTED_RESULT_HASH}`)
    }
}
