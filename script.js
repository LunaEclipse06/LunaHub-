
const { createApp, ref, computed, watch, onMounted, nextTick } = Vue;

createApp({
  setup() {
    const year = new Date().getFullYear();

   // THEME
const theme = ref(localStorage.getItem("lunaTheme") || "dark");

function applyTheme(value) {
  document.documentElement.setAttribute("data-theme", value);
  document.body.setAttribute("data-theme", value);
  localStorage.setItem("lunaTheme", value);
}

function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
}

watch(theme, (newTheme) => {
  applyTheme(newTheme);
}, { immediate: true });
    // MUSIC PLAYER
    const defaultCover =
      "https://placehold.co/500x500/171d36/ffffff?text=lunaEclipse";

    const playlist = ref([]);
    const currentIndex = ref(0);
    const currentTrack = ref({});
    const audio = ref(null);
    const audioUrl = ref("");
    const musicMode = ref("audio");
    const embedUrl = ref("");
    const musicTitle = ref("");
    const musicLink = ref("");
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const volume = ref(0.7);
    const musicError = ref("");
    const uploadedUrls = [];

    function youtubeId(url) {
      try {
        const parsed = new URL(url);

        if (parsed.hostname === "youtu.be") {
          return parsed.pathname.split("/").filter(Boolean)[0] || "";
        }

        if (parsed.hostname.includes("youtube.com")) {
          if (parsed.pathname === "/watch") {
            return parsed.searchParams.get("v") || "";
          }

          const parts = parsed.pathname.split("/").filter(Boolean);

          if (["embed", "shorts", "live"].includes(parts[0])) {
            return parts[1] || "";
          }
        }
      } catch {}

      return "";
    }

    function spotifyEmbed(url) {
      try {
        const parsed = new URL(url);

        if (!parsed.hostname.includes("spotify.com")) return "";

        const parts = parsed.pathname.split("/").filter(Boolean);
        const index = parts.findIndex(part =>
          ["track", "album", "playlist", "artist", "show", "episode"].includes(part)
        );

        if (index < 0 || !parts[index + 1]) return "";

        return `https://open.spotify.com/embed/${parts[index]}/${parts[index + 1]}`;
      } catch {
        return "";
      }
    }

    function detectMusic(url) {
      const yt = youtubeId(url);

      if (yt) {
        return {
          mode: "youtube",
          embed: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`
        };
      }

      const spotify = spotifyEmbed(url);

      if (spotify) {
        return { mode: "spotify", embed: spotify };
      }

      return { mode: "audio", embed: "" };
    }

    async function loadPlaylist() {
      let defaults = [];

      try {
        const response = await fetch("./playlist.json");

        if (!response.ok) throw new Error("Playlist file unavailable.");

        const data = await response.json();
        defaults = Array.isArray(data.playlist) ? data.playlist : [];
      } catch (error) {
        console.warn(error);

        defaults = [
          {
            id: "lofi-1",
            title: "Lofi Gaming Mix",
            artist: "SomaFM Groove Salad",
            url: "https://ice1.somafm.com/groovesalad-128-mp3",
            cover: defaultCover
          },
          {
            id: "lofi-2",
            title: "Chill Gaming Beats",
            artist: "SomaFM DEF CON",
            url: "https://ice1.somafm.com/defcon-128-mp3",
            cover: defaultCover
          }
        ];
      }

      let custom = [];

      try {
        custom = JSON.parse(localStorage.getItem("lunaCustomMusic") || "[]");
      } catch {
        custom = [];
      }

      playlist.value = [...defaults, ...custom];

      if (playlist.value.length) {
        await selectTrack(0, false);
      }
    }

    function saveCustomPlaylist() {
      const custom = playlist.value.filter(track =>
        track.custom === true && !track.localFile
      );

      localStorage.setItem("lunaCustomMusic", JSON.stringify(custom));
    }

    async function selectTrack(index, autoplay = true) {
      if (index < 0 || index >= playlist.value.length) return;

      if (audio.value) audio.value.pause();

      isPlaying.value = false;
      currentIndex.value = index;
      currentTrack.value = playlist.value[index];
      currentTime.value = 0;
      duration.value = 0;
      musicError.value = "";

      const detected = detectMusic(currentTrack.value.url);

      musicMode.value = detected.mode;
      embedUrl.value = detected.embed;
      audioUrl.value = detected.mode === "audio"
        ? currentTrack.value.url
        : "";

      if (detected.mode !== "audio") return;

      await nextTick();

      if (!audio.value) return;

      audio.value.volume = volume.value;
      audio.value.load();

      if (autoplay) {
        try {
          await audio.value.play();
          isPlaying.value = true;
        } catch {
          musicError.value = "Unable to play this audio. Check the link.";
        }
      }
    }

    async function togglePlay() {
      if (musicMode.value !== "audio" || !audio.value) return;

      musicError.value = "";

      if (audio.value.paused) {
        try {
          await audio.value.play();
          isPlaying.value = true;
        } catch {
          isPlaying.value = false;
          musicError.value = "Unable to play this audio.";
        }
      } else {
        audio.value.pause();
        isPlaying.value = false;
      }
    }

    function previousTrack() {
      if (!playlist.value.length) return;

      const index =
        (currentIndex.value - 1 + playlist.value.length) %
        playlist.value.length;

      selectTrack(index);
    }

    function nextTrack() {
      if (!playlist.value.length) return;

      const index = (currentIndex.value + 1) % playlist.value.length;
      selectTrack(index);
    }

    function updateTime() {
      if (!audio.value) return;

      currentTime.value = audio.value.currentTime || 0;
      duration.value = Number.isFinite(audio.value.duration)
        ? audio.value.duration : 0;
    }

    function updateDuration() {
      if (!audio.value) return;

      duration.value = Number.isFinite(audio.value.duration)
        ? audio.value.duration : 0;
    }

    function seekAudio() {
      if (audio.value && Number.isFinite(audio.value.duration)) {
        audio.value.currentTime = currentTime.value;
      }
    }

    function changeVolume() {
      if (audio.value) audio.value.volume = volume.value;
    }

    function formatTime(seconds) {
      if (!Number.isFinite(seconds)) return "0:00";

      const minutes = Math.floor(seconds / 60);
      const remaining = Math.floor(seconds % 60);

      return `${minutes}:${String(remaining).padStart(2, "0")}`;
    }

    function handleAudioError() {
      if (!audioUrl.value) return;

      isPlaying.value = false;
      musicError.value =
        "Audio could not be loaded. Try another direct audio link.";
    }

    function addMusic() {
      const url = musicLink.value.trim();

      if (!url) {
        musicError.value = "Please enter a music URL.";
        return;
      }

      try {
        const parsed = new URL(url);

        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("Invalid URL");
        }
      } catch {
        musicError.value = "Please enter a valid HTTP or HTTPS URL.";
        return;
      }

      const detected = detectMusic(url);

      const track = {
        id: "custom-" + Date.now(),
        title: musicTitle.value.trim() ||
          (detected.mode === "youtube" ? "YouTube Music" :
           detected.mode === "spotify" ? "Spotify Music" : "My Music"),
        artist: "Added by you",
        url,
        cover: defaultCover,
        custom: true
      };

      playlist.value.push(track);
      saveCustomPlaylist();

      musicTitle.value = "";
      musicLink.value = "";
      selectTrack(playlist.value.length - 1);
    }

    function uploadMusic(event) {
      const file = event.target.files?.[0];

      if (!file) return;

      if (!file.type.startsWith("audio/")) {
        musicError.value = "Please select an audio file.";
        event.target.value = "";
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      uploadedUrls.push(objectUrl);

      playlist.value.push({
        id: "upload-" + Date.now(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Uploaded from your device",
        url: objectUrl,
        cover: defaultCover,
        localFile: true
      });

      selectTrack(playlist.value.length - 1);
      event.target.value = "";
    }

    // JOKES
    const joke = ref(
      "Why did the computer go to the doctor? Because it had a virus!"
    );

    const jokeLoading = ref(false);

    async function getJoke() {
      jokeLoading.value = true;

      try {
        const response = await fetch(
          "https://v2.jokeapi.dev/joke/Any?safe-mode"
        );

        if (!response.ok) throw new Error("Joke service unavailable.");

        const data = await response.json();

        joke.value = data.type === "twopart"
          ? `${data.setup}\n\n${data.delivery}`
          : data.joke;
      } catch {
        joke.value =
          "Oops! The joke service is unavailable. Please try again.";
      } finally {
        jokeLoading.value = false;
      }
    }

    // YOUTUBE
    const YOUTUBE_API_KEY = "AIzaSyB7iNGDksYhbVYLASbNeWNW8A7iL1Sosek";

    const videoQuery = ref("gaming");
    const videos = ref([]);
    const videoStatus = ref("Add your YouTube API key to enable search.");
    const nextToken = ref("");
    const previousToken = ref("");
    const videoPage = ref(1);

    async function searchVideos(direction = "new") {
      if (YOUTUBE_API_KEY === "YOUR_API_KEY_HERE") {
        videoStatus.value =
          "Add your YouTube API key inside script.js to enable search.";
        videos.value = [];
        return;
      }

      const query = videoQuery.value.trim();

      if (!query) {
        videoStatus.value = "Enter a search keyword.";
        return;
      }

      let token = "";

      if (direction === "next") token = nextToken.value;
      if (direction === "previous") token = previousToken.value;
      if (direction === "new") {
        videoPage.value = 1;
        previousToken.value = "";
      }

      videoStatus.value = "Searching YouTube...";
      videos.value = [];

      try {
        const params = new URLSearchParams({
          part: "snippet",
          type: "video",
          maxResults: "9",
          q: query,
          key: YOUTUBE_API_KEY
        });

        if (token) params.set("pageToken", token);

        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?${params}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || "YouTube search failed.");
        }

        videos.value = data.items || [];
        nextToken.value = data.nextPageToken || "";
        previousToken.value = data.prevPageToken || "";

        if (direction === "next") videoPage.value++;
        if (direction === "previous") {
          videoPage.value = Math.max(1, videoPage.value - 1);
        }

        videoStatus.value = videos.value.length
          ? `${videos.value.length} videos found.`
          : "No videos found.";
      } catch (error) {
        videoStatus.value = error.message;
      }
    }

    function nextVideos() {
      if (nextToken.value) searchVideos("next");
    }

    function previousVideos() {
      if (previousToken.value) searchVideos("previous");
    }

    // YOUTUBE VIDEO PLAYER
    const videoModalOpen = ref(false);
    const videoEmbedUrl = ref("");

    function watchVideo(id) {
      videoEmbedUrl.value =
        `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1`;

      videoModalOpen.value = true;
    }

    function closeVideo() {
      videoModalOpen.value = false;
      videoEmbedUrl.value = "";
    }

    // GAME THUMBNAIL GENERATOR
    function escapeSvgText(value) {
      return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;"
      })[character]);
    }

    function createGameThumbnail(game) {
      const palettes = {
        Puzzle: ["#30206f", "#8b5cf6", "#c4b5fd"],
        Arcade: ["#071d48", "#0878c9", "#67e8f9"],
        Casual: ["#563015", "#d97706", "#fcd34d"],
        Classic: ["#173d35", "#159b79", "#a7f3d0"],
        Word: ["#451b58", "#a855f7", "#e9d5ff"],
        Quiz: ["#153c57", "#0891b2", "#a5f3fc"]
      };

      const [start, end, accent] =
        palettes[game.category] || palettes.Arcade;

      const title = escapeSvgText(game.title);
      const emoji = escapeSvgText(game.emoji);

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg"
             width="640" height="360" viewBox="0 0 640 360">
          <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="${start}"/>
              <stop offset="100%" stop-color="${end}"/>
            </linearGradient>
            <radialGradient id="glow">
              <stop offset="0%" stop-color="${accent}" stop-opacity=".65"/>
              <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
            </radialGradient>
          </defs>

          <rect width="640" height="360" rx="24" fill="url(#bg)"/>
          <circle cx="500" cy="75" r="180" fill="url(#glow)"/>
          <circle cx="100" cy="310" r="150" fill="url(#glow)"/>

          <circle cx="520" cy="280" r="75"
                  fill="none" stroke="${accent}"
                  stroke-opacity=".25" stroke-width="3"/>

          <circle cx="120" cy="65" r="38"
                  fill="${accent}" opacity=".12"/>

          <path d="M0 280 Q160 210 320 290 T640 250 V360 H0Z"
                fill="#080b1b" opacity=".20"/>

          <text x="320" y="175" font-size="112"
                text-anchor="middle"
                dominant-baseline="middle">${emoji}</text>

          <rect x="24" y="285" width="592" height="52"
                rx="14" fill="#080b1b" opacity=".55"/>

          <text x="320" y="319"
                font-family="Arial, sans-serif"
                font-size="25"
                font-weight="bold"
                fill="#ffffff"
                text-anchor="middle">${title}</text>
        </svg>
      `;

      return "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg);
    }

    // PLAYBOLT GAME CATALOGUE
    const games = ref([
      { title: "2048", slug: "2048", category: "Puzzle", emoji: "🔢", description: "Merge matching tiles to reach 2048.", image: "https://playbolt.app/assets/shots/2048.webp?v=31066" },
      { title: "Hextris", slug: "hextris", category: "Puzzle", emoji: "🔷", description: "Fit falling shapes around the hexagon." },
      { title: "Astray", slug: "astray", category: "Arcade", emoji: "🌀", description: "Navigate a maze and find your way out." },
      { title: "Tetris", slug: "tetris", category: "Puzzle", emoji: "🧱", description: "Stack falling blocks and clear lines." },
      { title: "Breakout", slug: "breakout", category: "Arcade", emoji: "🧱", description: "Break the bricks with your bouncing ball." },
      { title: "Floppy Bird", slug: "floppy-bird", category: "Arcade", emoji: "🐦", description: "Fly through obstacles without crashing." },
      { title: "T-Rex Runner", slug: "t-rex-runner", category: "Arcade", emoji: "🦖", description: "Run and jump over obstacles." },
      { title: "Tower Game", slug: "tower-game", category: "Casual", emoji: "🏗️", description: "Stack blocks and build a tall tower." },
      { title: "Duck Hunt", slug: "duck-hunt", category: "Arcade", emoji: "🦆", description: "Test your aim in this classic game." },
      { title: "Minesweeper", slug: "minesweeper", category: "Puzzle", emoji: "💣", description: "Find safe squares and avoid mines." },
      { title: "Memory Match", slug: "memory-match", category: "Puzzle", emoji: "🧠", description: "Match the pairs of hidden cards." },
      { title: "Sliding Puzzle", slug: "sliding-puzzle", category: "Puzzle", emoji: "🧩", description: "Slide tiles into the correct order." },
      { title: "Snake", slug: "snake", category: "Arcade", emoji: "🐍", description: "Eat, grow and avoid your own tail." },
      { title: "Whack-a-Mole", slug: "whack-a-mole", category: "Casual", emoji: "🔨", description: "Hit the moles before they disappear." },
      { title: "Neon Pong", slug: "neon-pong", category: "Arcade", emoji: "🏓", description: "Play a glowing arcade paddle game." },
      { title: "Star Defender", slug: "star-defender", category: "Arcade", emoji: "🚀", description: "Defend your space against incoming threats." },
      { title: "Rock Blaster", slug: "rock-blaster", category: "Arcade", emoji: "☄️", description: "Blast rocks and survive the action." },
      { title: "Piano Tiles", slug: "piano-tiles", category: "Casual", emoji: "🎹", description: "Tap the correct piano keys." },
      { title: "Aim Trainer", slug: "aim-trainer", category: "Arcade", emoji: "🎯", description: "Improve your speed and accuracy." },
      { title: "Sky Hopper", slug: "sky-hopper", category: "Arcade", emoji: "☁️", description: "Hop through the sky and avoid danger." },
      { title: "Lights Out", slug: "lights-out", category: "Puzzle", emoji: "💡", description: "Turn off every light on the board." },
      { title: "Sudoku", slug: "sudoku", category: "Puzzle", emoji: "🔢", description: "Complete the number grid." },
      { title: "Nonogram", slug: "nonogram", category: "Puzzle", emoji: "🟦", description: "Reveal a hidden picture using clues." },
      { title: "Sokoban", slug: "sokoban", category: "Puzzle", emoji: "📦", description: "Push boxes into their target positions." },
      { title: "Connect Four", slug: "connect-four", category: "Classic", emoji: "🔴", description: "Connect four pieces before your opponent." },
      { title: "Reversi", slug: "reversi", category: "Classic", emoji: "⚫", description: "Flip your opponent's pieces." },
      { title: "Hangman", slug: "hangman", category: "Word", emoji: "🔤", description: "Guess the hidden word." },
      { title: "Simon Says", slug: "simon-says", category: "Casual", emoji: "🟢", description: "Remember and repeat the colour sequence." },
      { title: "Typing Test", slug: "typing-test", category: "Word", emoji: "⌨️", description: "Test your typing speed." },
      { title: "Blackjack", slug: "blackjack", category: "Classic", emoji: "🃏", description: "Try to reach 21 without going over." },
      { title: "Word Search", slug: "word-search", category: "Word", emoji: "🔎", description: "Find hidden words in the grid." },
      { title: "Word Guess", slug: "word-guess", category: "Word", emoji: "📝", description: "Guess the secret word." },
      { title: "Anagrams", slug: "anagrams", category: "Word", emoji: "🔠", description: "Rearrange letters to make words." },
      { title: "Missing Letter", slug: "missing-letter", category: "Word", emoji: "❓", description: "Find the missing letter." },
      { title: "Capital Cities Quiz", slug: "capitals-quiz", category: "Quiz", emoji: "🌍", description: "Test your world geography knowledge." },
      { title: "Math Sprint", slug: "math-sprint", category: "Quiz", emoji: "➗", description: "Solve maths questions against the clock." },
      { title: "General Knowledge Quiz", slug: "general-knowledge", category: "Quiz", emoji: "🧠", description: "Challenge your general knowledge." },
      { title: "True or False", slug: "true-or-false", category: "Quiz", emoji: "✔️", description: "Decide whether each statement is true." },
      { title: "Solitaire", slug: "solitaire", category: "Classic", emoji: "🂡", description: "Arrange the cards in order." },
      { title: "Checkers", slug: "checkers", category: "Classic", emoji: "♟️", description: "Play a classic board game." },
      { title: "Mancala", slug: "mancala", category: "Classic", emoji: "⚪", description: "Collect the most stones." },
      { title: "Dots and Boxes", slug: "dots-and-boxes", category: "Classic", emoji: "🔲", description: "Complete boxes and claim the points." },
      { title: "Battleship", slug: "battleship", category: "Classic", emoji: "🚢", description: "Find and sink the hidden ships." },
      { title: "Tic-Tac-Toe", slug: "tic-tac-toe", category: "Classic", emoji: "❌", description: "Get three marks in a row." },
      { title: "Table Tennis", slug: "table-tennis", category: "Classic", emoji: "🏓", description: "Play table tennis against a computer." },
      { title: "Air Hockey", slug: "air-hockey", category: "Classic", emoji: "🏒", description: "Score goals in an air hockey match." },
      { title: "Reaction Duel", slug: "reaction-duel", category: "Classic", emoji: "⚡", description: "Challenge your reaction speed." },
      { title: "Turbo Lane", slug: "turbo-lane", category: "Arcade", emoji: "🏎️", description: "Race through traffic." },
      { title: "City Dash", slug: "city-dash", category: "Arcade", emoji: "🏙️", description: "Dash through a busy city." },
      { title: "Robo Siege", slug: "robo-siege", category: "Arcade", emoji: "🤖", description: "Defend against robotic enemies." },
      { title: "Neon Runner 3D", slug: "neon-runner-3d", category: "Arcade", emoji: "🏃", description: "Run, jump and slide through a 3D world." },
      { title: "Inkfall", slug: "inkfall", category: "Arcade", emoji: "🖌️", description: "Survive a flooding paper arena." },
      { title: "Gearbloom", slug: "gearbloom", category: "Casual", emoji: "⚙️", description: "Build a deck in a clockwork greenhouse." },
      { title: "Life Replay", slug: "life-replay", category: "Casual", emoji: "🌱", description: "Make choices in a life simulator." },
      { title: "Rope Snack", slug: "rope-snack", category: "Puzzle", emoji: "🍓", description: "Cut ropes and solve physics puzzles." },
      { title: "Unbolted", slug: "unbolted", category: "Puzzle", emoji: "🔩", description: "Unscrew layered plates in the right order." },
      { title: "Merge Drop", slug: "merge-drop", category: "Puzzle", emoji: "🟣", description: "Drop and merge matching pieces." }
    ]);

    // Give every game a thumbnail if it does not already have one.
    games.value = games.value.map(game => ({
      ...game,
      image: game.image || createGameThumbnail(game)
    }));

    function handleGameImageError(game) {
      if (game.image && !game.image.startsWith("data:image/svg+xml")) {
        game.image = createGameThumbnail(game);
      } else {
        game.image = "";
      }
    }

    // GAME SEARCH AND PAGINATION
    const gameQuery = ref("");
    const gameCategory = ref("All");
    const gamePage = ref(1);
    const gamesPerPage = 12;

    const gameCategories = computed(() =>
      [...new Set(games.value.map(game => game.category))].sort()
    );

    const filteredGames = computed(() => {
      const query = gameQuery.value.trim().toLowerCase();

      return games.value.filter(game => {
        const matchesQuery =
          !query ||
          `${game.title} ${game.category} ${game.description}`
            .toLowerCase()
            .includes(query);

        const matchesCategory =
          gameCategory.value === "All" ||
          game.category === gameCategory.value;

        return matchesQuery && matchesCategory;
      });
    });

    const totalGamePages = computed(() =>
      Math.max(1, Math.ceil(filteredGames.value.length / gamesPerPage))
    );

    const paginatedGames = computed(() => {
      const start = (gamePage.value - 1) * gamesPerPage;

      return filteredGames.value.slice(start, start + gamesPerPage);
    });

    const gameStatus = computed(() =>
      `${filteredGames.value.length} PlayBolt games available.`
    );

    watch([gameQuery, gameCategory], () => {
      gamePage.value = 1;
    });

    watch(totalGamePages, pages => {
      if (gamePage.value > pages) gamePage.value = pages;
    });

    // PLAYBOLT PLAYER
    const gameModalOpen = ref(false);
    const gameFrame = ref(null);
    const gameFrameUrl = ref("");
    const selectedGame = ref({ title: "" });

    function playGame(game) {
      selectedGame.value = game;
      gameFrameUrl.value =
        `https://playbolt.app/play/${encodeURIComponent(game.slug)}/`;

      gameModalOpen.value = true;
      document.body.style.overflow = "hidden";
    }

    function closeGame() {
      gameModalOpen.value = false;
      gameFrameUrl.value = "";
      selectedGame.value = { title: "" };
      document.body.style.overflow = "";
    }

    function fullscreenGame() {
      const frame = gameFrame.value;

      if (!frame) return;

      if (frame.requestFullscreen) {
        frame.requestFullscreen().catch(error => {
          console.warn("Fullscreen could not start:", error);
        });
      }
    }

    function nextGames() {
      if (gamePage.value < totalGamePages.value) {
        gamePage.value++;
      }
    }

    function previousGames() {
      if (gamePage.value > 1) {
        gamePage.value--;
      }
    }

    // REVIEWS
    const reviewName = ref("");
    const reviewRating = ref(5);
    const reviewText = ref("");
    const reviews = ref([]);

    function loadReviews() {
      try {
        reviews.value =
          JSON.parse(localStorage.getItem("lunaReviews") || "[]");

        if (!Array.isArray(reviews.value)) reviews.value = [];
      } catch {
        reviews.value = [];
      }
    }

    function submitReview() {
      if (!reviewName.value.trim() || !reviewText.value.trim()) return;

      reviews.value.unshift({
        id: Date.now(),
        name: reviewName.value.trim(),
        rating: reviewRating.value,
        text: reviewText.value.trim(),
        date: new Date().toLocaleDateString()
      });

      localStorage.setItem("lunaReviews", JSON.stringify(reviews.value));

      reviewName.value = "";
      reviewRating.value = 5;
      reviewText.value = "";
    }

    onMounted(() => {
      loadPlaylist();
      loadReviews();
    });

    return {
      year,
      theme,
      toggleTheme,

      defaultCover,
      playlist,
      currentIndex,
      currentTrack,
      audio,
      audioUrl,
      musicMode,
      embedUrl,
      musicTitle,
      musicLink,
      isPlaying,
      currentTime,
      duration,
      volume,
      musicError,
      selectTrack,
      togglePlay,
      previousTrack,
      nextTrack,
      updateTime,
      updateDuration,
      seekAudio,
      changeVolume,
      formatTime,
      handleAudioError,
      addMusic,
      uploadMusic,

      joke,
      jokeLoading,
      getJoke,

      videoQuery,
      videos,
      videoStatus,
      nextToken,
      previousToken,
      videoPage,
      searchVideos,
      nextVideos,
      previousVideos,
      videoModalOpen,
      videoEmbedUrl,
      watchVideo,
      closeVideo,

      games,
      gameQuery,
      gameCategory,
      gameCategories,
      filteredGames,
      paginatedGames,
      gamePage,
      totalGamePages,
      gameStatus,
      nextGames,
      previousGames,
      handleGameImageError,

      gameModalOpen,
      gameFrame,
      gameFrameUrl,
      selectedGame,
      playGame,
      closeGame,
      fullscreenGame,

      reviewName,
      reviewRating,
      reviewText,
      reviews,
      submitReview
    };
  }
}).mount("#app");
