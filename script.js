
document.addEventListener("DOMContentLoaded", function () {
    const $ = (id) => document.getElementById(id);

    let tasks = [];
    let editingId = null;
    let currentFilter = "all";
    let timerDuration = 25 * 60;
    let timeLeft = timerDuration;
    let timerInterval = null;
    let isRunning = false;
    let timerMode = "focus";

    // Load saved tasks
    try {
        const savedTasks = JSON.parse(localStorage.getItem("taskflowTasks"));
        if (Array.isArray(savedTasks)) {
            tasks = savedTasks.filter(
                task => task &&
                    typeof task.id === "string" &&
                    typeof task.title === "string"
            );
        }
    } catch (error) {
        tasks = [];
    }

    // Today's date
    const dateElement = $("currentDate");
    if (dateElement) {
        dateElement.textContent = new Date().toLocaleDateString(
            "en-US",
            { weekday: "short", month: "short", day: "numeric", year: "numeric" }
        );
    }

    // Save tasks in browser
    function saveTasks() {
        try {
            localStorage.setItem("taskflowTasks", JSON.stringify(tasks));
        } catch (error) {
            alert("Tasks could not be saved in this browser.");
        }
    }

    // Page navigation
    const pages = {
        dashboard: "dashboardPage",
        tasks: "tasksPage",
        pomodoro: "pomodoroPage",
        stats: "statsPage"
    };

    const pageDetails = {
        dashboard: ["Dashboard", "Plan your day. Get things done."],
        tasks: ["Tasks", "Organize your activities."],
        pomodoro: ["Pomodoro", "Focus on one thing at a time."],
        stats: ["Stats", "Track your productivity."]
    };

    function showPage(page) {
        if (!pages[page]) return;

        Object.entries(pages).forEach(([key, id]) => {
            $(id).hidden = key !== page;
        });

        document.querySelectorAll(".nav-item").forEach(button => {
            button.classList.toggle("active", button.dataset.page === page);
        });

        $("pageTitle").textContent = pageDetails[page][0];
        $("pageSubtitle").textContent = pageDetails[page][1];

        if (page === "tasks") renderTasksPage();
        if (page === "stats") updateStats();
    }

    document.querySelectorAll(".nav-item").forEach(button => {
        button.addEventListener("click", () => {
            showPage(button.dataset.page);
        });
    });

    document.querySelectorAll("[data-go-page]").forEach(button => {
        button.addEventListener("click", () => {
            showPage(button.dataset.goPage);
        });
    });

    // Create a task element safely
    function createTaskElement(task) {
        const item = document.createElement("article");
        item.className = "task-item";
        if (task.completed) item.classList.add("completed");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(task.completed);
        checkbox.className = "task-checkbox";
        checkbox.setAttribute("aria-label", "Mark task complete");

        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            saveTasks();
            renderAll();
        });

        const content = document.createElement("div");
        content.className = "task-content";

        const title = document.createElement("span");
        title.className = "task-title";
        title.textContent = task.title;
        if (task.completed) title.classList.add("completed-title");

        const meta = document.createElement("span");
        meta.className = "task-meta";
        meta.textContent = task.priority.charAt(0).toUpperCase()
            + task.priority.slice(1) + " priority";

        content.append(title, meta);

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "icon-button";
        editButton.textContent = "Edit";
        editButton.disabled = Boolean(task.completed);
        editButton.addEventListener("click", () => editTask(task.id));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "icon-button delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteTask(task.id));

        actions.append(editButton, deleteButton);

        const priority = document.createElement("span");
        priority.className = "priority-badge priority-" + task.priority;
        priority.textContent = task.priority;

        item.append(checkbox, content, priority, actions);
        return item;
    }

    // Render task lists
    function renderList(containerId, emptyId, list) {
        const container = $(containerId);
        const empty = $(emptyId);

        container.replaceChildren();

        list.forEach(task => {
            container.appendChild(createTaskElement(task));
        });

        empty.hidden = list.length > 0;
    }

    function renderDashboard() {
        const list = $("taskList");
        list.replaceChildren();

        tasks.forEach(task => {
            list.appendChild(createTaskElement(task));
        });

        $("emptyState").hidden = tasks.length > 0;
        $("visibleTaskCount").textContent =
            tasks.length + (tasks.length === 1 ? " task" : " tasks");

        const completed = tasks.filter(task => task.completed).length;
        const percentage = tasks.length
            ? Math.round(completed / tasks.length * 100)
            : 0;

        $("progressPercent").textContent = percentage + "%";
        $("progressBar").style.width = percentage + "%";
    }

    function renderTasksPage() {
        const filtered = tasks.filter(task => {
            if (currentFilter === "pending") return !task.completed;
            if (currentFilter === "completed") return task.completed;
            return true;
        });

        renderList("tasksPageList", "tasksPageEmpty", filtered);
    }

    function updateStats() {
        const total = tasks.length;
        const completed = tasks.filter(task => task.completed).length;
        const pending = total - completed;
        const rate = total ? Math.round(completed / total * 100) : 0;

        $("totalTasks").textContent = total;
        $("pendingTasks").textContent = pending;
        $("completedTasks").textContent = completed;

        $("statsTotal").textContent = total;
        $("statsCompleted").textContent = completed;
        $("statsRate").textContent = rate + "%";
        $("statsProgressText").textContent = rate + "%";
        $("statsProgressBar").style.width = rate + "%";
    }

    function renderAll() {
        saveTasks();
        renderDashboard();
        renderTasksPage();
        updateStats();
    }

    // Add a new task or save an edit
    $("taskForm").addEventListener("submit", function (event) {
        event.preventDefault();

        const title = $("taskInput").value.trim();
        const priority = $("taskPriority").value;

        if (!title) {
            $("taskInput").focus();
            return;
        }

        if (editingId !== null) {
            const task = tasks.find(task => task.id === editingId);

            if (task) {
                task.title = title;
                task.priority = priority;
            }

            editingId = null;
            $("submitButton").textContent = "+ Add Task";
            $("editNotice").hidden = true;
        } else {
            tasks.unshift({
                id: Date.now().toString() + Math.random().toString(16).slice(2),
                title: title,
                priority: priority,
                completed: false
            });
        }

        $("taskInput").value = "";
        $("taskPriority").value = "medium";

        renderAll();
        $("taskInput").focus();
    });

    function editTask(id) {
        const task = tasks.find(task => task.id === id);
        if (!task || task.completed) return;

        editingId = id;
        $("taskInput").value = task.title;
        $("taskPriority").value = task.priority;
        $("submitButton").textContent = "Save Changes";
        $("editNotice").hidden = false;

        showPage("dashboard");
        $("taskInput").focus();
    }

    function cancelEdit() {
        editingId = null;
        $("taskForm").reset();
        $("taskPriority").value = "medium";
        $("submitButton").textContent = "+ Add Task";
        $("editNotice").hidden = true;
    }

    $("cancelEdit").addEventListener("click", cancelEdit);

    function deleteTask(id) {
        const confirmed = confirm("Are you sure you want to delete this task?");
        if (!confirmed) return;

        tasks = tasks.filter(task => task.id !== id);

        if (editingId === id) cancelEdit();

        renderAll();
    }

    // All / Pending / Completed filters
    document.querySelectorAll("[data-filter]").forEach(button => {
        button.addEventListener("click", () => {
            currentFilter = button.dataset.filter;

            document.querySelectorAll("[data-filter]").forEach(item => {
                item.classList.toggle("active", item === button);
            });

            renderTasksPage();
        });
    });

    // Pomodoro timer
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;

        $("timerDisplay").textContent =
            String(minutes).padStart(2, "0") + ":" +
            String(seconds).padStart(2, "0");
    }

    function stopTimer() {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        isRunning = false;
    }

    $("startTimer").addEventListener("click", () => {
        if (isRunning) return;

        if (timeLeft <= 0) timeLeft = timerDuration;

        isRunning = true;

        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();

            if (timeLeft <= 0) {
                stopTimer();
                $("timerMode").textContent = "SESSION COMPLETE";
                alert("Your " + (timerMode === "focus" ? "focus session" : "break")
                    + " is complete!");
            }
        }, 1000);
    });

    $("pauseTimer").addEventListener("click", stopTimer);

    $("resetTimer").addEventListener("click", () => {
        stopTimer();
        timeLeft = timerDuration;
        $("timerMode").textContent =
            timerMode === "focus" ? "FOCUS SESSION" : "SHORT BREAK";
        updateTimerDisplay();
    });

    document.querySelectorAll("[data-duration]").forEach(button => {
        button.addEventListener("click", () => {
            stopTimer();

            timerDuration = Number(button.dataset.duration) * 60;
            timeLeft = timerDuration;
            timerMode = Number(button.dataset.duration) === 25
                ? "focus"
                : "break";

            document.querySelectorAll("[data-duration]").forEach(item => {
                item.classList.toggle("active", item === button);
            });

            $("timerMode").textContent =
                timerMode === "focus" ? "FOCUS SESSION" : "SHORT BREAK";

            updateTimerDisplay();
        });
    });

    // Initial display
    renderAll();
    updateTimerDisplay();
});
