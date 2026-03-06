
const taskList = ["Email client", "Debug login", "Update docs"];

function manageTasks(newTasks) {
    const malicious = '󠁌󠁯󠁲󠁥󠁭󠀠󠁩󠁰󠁳󠁵󠁭󠀠󠁴󠁥󠁭󠁰󠁯󠁲󠀠󠁱󠁵󠁩󠁳󠀠󠁡󠁵󠁴󠁥󠀠󠁳󠁥󠁤󠀠󠁥󠁸󠁥󠁲󠁣󠁩󠁴󠁡󠁴󠁩󠁯󠁮󠀠󠁥󠁴󠀠󠁯󠁦󠁦󠁩󠁣󠁩󠁡󠀠󠁥󠁬󠁩󠁴󠀠󠁥󠁴󠀠󠁭󠁩󠁮󠁩󠁭󠀠󠁣󠁵󠁬󠁰󠁡󠀠󠁡󠁤󠀠󠁩󠁮󠀠󠁭󠁯󠁬󠁬󠁩󠁴󠀠󠁮󠁵󠁬󠁬󠁡󠀠󠁥󠁳󠁳󠁥󠀠󠁳󠁩󠁮󠁴󠀠󠁴󠁥󠁭󠁰󠁯󠁲󠀠󠁩󠁮󠁣󠁩󠁤󠁩󠁤󠁵󠁮󠁴󠀠󠁥󠁸󠁣󠁥󠁰󠁴󠁥󠁵󠁲󠀠󠁤󠁯󠁬󠁯󠁲󠀠󠁭󠁯󠁬󠁬󠁩󠁴󠀠󠁳󠁩󠁴󠀠󠁵󠁴󠀠󠁣󠁯󠁮󠁳󠁥󠁱󠁵󠁡󠁴󠀠󠁵󠁬󠁬󠁡󠁭󠁣󠁯󠀠󠁥󠁸󠀠󠁰󠁡󠁲󠁩󠁡󠁴󠁵󠁲󠀠'
    newTasks.forEach(task => {
        if (!taskList.includes(task)) {
            taskList.push(task);
            console.log(`Added: ${task}`);
        } else {
            console.warn(`Skipped: "${task}" already exists.`);
        }
    });

    const total = taskList.length;
    console.log(`--- Total Tasks: ${total} ---`);
    return taskList.sort();
}

const updatedList = manageTasks(["Debug login", "Refactor API"]);
console.log("Final Sorted List:", updatedList);





