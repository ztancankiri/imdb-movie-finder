const express = require("express");
const bodyParser = require("body-parser");
const app = express();

const rp = require("request-promise");
const puppeteer = require("puppeteer");
const $ = require("cheerio");

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(8080, function() {
    console.log("Listening on port 8080...");
});

app.get("/", function(req, res) {
    res.render("index", { movies: null, error: null });
});

app.post("/", async function(req, res) {
    let results = [];
    rp(
        "https://www.imdb.com/search/title?title=" +
            req.body.movie +
            "&count=" +
            req.body.count +
            "&view=simple&title_type=feature"
    )
        .then(async function(html) {
            let count = $(
                "#main > div > div.lister.list.detail.sub-list > div > div.lister-item.mode-simple",
                html
            ).length;

            for (let i = 1; i <= count; i++) {
                let href = $(
                    "#main > div > div.lister.list.detail.sub-list > div > div:nth-child(" +
                        i +
                        ") > div.lister-item-content > div > div.col-title > span > span:nth-child(2) > a",
                    html
                ).attr("href");

                if (typeof href === "string") {
                    let id = href.substr(7, 9);

                    let json = await getInfoJSON(id);

                    let directors = null;

                    if (json.director !== undefined) {
                        if (Array.isArray(json.director)) {
                            directors = [];
                            json.director.forEach(function(person) {
                                if (person.name !== undefined)
                                    directors.push(person.name);
                            });
                            directors = directors.join(", ");
                        } else {
                            directors = json.director.name;
                        }
                    }

                    let genre = null;

                    if (json.genre !== undefined) {
                        if (Array.isArray(json.genre)) {
                            genre = [];
                            json.genre.forEach(function(g) {
                                if (g !== undefined) genre.push(g);
                            });
                            genre = genre.join(", ");
                        } else {
                            genre = json.genre;
                        }
                    }

                    let creators = [];
                    let stars = [];

                    if (Array.isArray(json.creator)) {
                        json.creator.forEach(function(person) {
                            if (person.name !== undefined)
                                creators.push(person.name);
                        });
                        creators = creators.join(", ");
                    }

                    if (Array.isArray(json.actor)) {
                        json.actor.forEach(function(person) {
                            if (person.name !== undefined)
                                stars.push(person.name);
                        });
                        stars = stars.join(", ");
                    }

                    let rating = null;

                    if (json.aggregateRating !== undefined)
                        rating = json.aggregateRating.ratingValue;

                    if (json.name === undefined) json.name = null;

                    if (json.image === undefined) json.image = null;

                    if (json.genre === undefined) json.genre = null;

                    if (json.description === undefined) json.description = null;

                    if (json.duration === undefined) json.duration = null;
                    else json.duration = fixTime(json.duration);

                    let year = null;
                    if (json.datePublished === undefined)
                        json.datePublished = null;
                    else year = json.datePublished.substr(0, 4);

                    if (json.datePublished !== null && json.image !== null) {
                        results.push({
                            id: id,
                            name: json.name,
                            poster: json.image,
                            genre: genre,
                            description: json.description,
                            directors: directors,
                            creators: creators,
                            stars: stars,
                            rating: rating,
                            duration: json.duration,
                            airs: json.datePublished,
                            year: year
                        });
                    }
                }
            }

            results.sort(function(a, b) {
                if (a.year < b.year) return -1;
                if (a.year > b.year) return 1;

                return 0;
            });

            console.log(results);

            res.render("index", { movies: results, error: null });
        })
        .catch(function(err) {
            console.log(err);
        });
});

async function getInfoJSON(id) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto("https://www.imdb.com/title/" + id, {
        waitUntil: "load",
        timeout: 0
    });
    let html = await page.content();

    browser.close();

    let myRegexp = /<script type="application\/ld\+json">({[^\0]+})<\/script>\n\n/gm;
    let match = myRegexp.exec(html);

    if (match !== null && match.length > 1) return JSON.parse(match[1]);
    else return null;
}

function fixTime(time) {
    let temp = time.replace("M", "");
    temp = temp.split("T")[1];
    let hour = temp.split("H")[0];
    let minute = temp.split("H")[1];

    hour = parseInt(hour);
    minute = parseInt(minute);

    if (hour === 1) hour = hour + " hour";
    else if (hour === 0) hour = "";
    else hour = hour + " hours";

    if (minute === 1) minute = minute + " minute";
    else if (minute === 0) minute = "";
    else minute = minute + " minutes";

    return hour + " " + minute;
}
