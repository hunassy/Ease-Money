// ============================================================
// 【データの保存場所について】
// このアプリのデータはすべて、ブラウザの localStorage という場所に
// 1つのまとまり（オブジェクト）として保存する。
// これにより、支出や収入などの機能を追加していっても
// 保存の仕組みを作り直さなくて済む。
// ============================================================

// localStorageに保存するときの「名前（キー）」
const STORAGE_KEY = "easeMoneyData";


// ============================================================
// 【画面切り替え関連】
// ホーム・支出・収入・定期・履歴・設定の6画面を、
// 「.app-screen」クラスを持つ要素の表示/非表示で切り替える。
// 別のHTMLファイルには分けず、1つのページの中で表示だけ切り替える方式。
// ============================================================

// 指定した名前の画面だけを表示し、それ以外の画面を隠す関数
// screenName には "home" "expense" "income" "recurring" "history" "settings" のいずれかを渡す
function showScreen(screenName) {
  // まずすべての画面を非表示にする
  document.querySelectorAll(".app-screen").forEach(function (screenElement) {
    screenElement.style.display = "none";
  });

  // 指定された画面だけを表示する
  document.getElementById("screen-" + screenName).style.display = "block";

  // 画面を切り替えたら、開いていたメニューがあれば自動で閉じる
  document.getElementById("side-menu").style.display = "none";

  // 下部ナビゲーションバーのボタンも、今の画面に合わせて強調表示を切り替える
  document.querySelectorAll("#app-nav .nav-button").forEach(function (button) {
    if (button.dataset.screen === screenName) {
      button.classList.add("nav-button-active");
    } else {
      button.classList.remove("nav-button-active");
    }
  });

  // 画面を切り替えたら、ページの一番上にスクロールし直す
  window.scrollTo(0, 0);
}


// データを読み込む関数
// まだ何も保存されていない場合は、空の初期データを返す
function loadData() {
  const savedText = localStorage.getItem(STORAGE_KEY);

  // 保存データが無い場合（初めてこのアプリを開いたとき）
  if (savedText === null) {
    return {
      initialBalance: null,   // 初期残高（まだ未設定 = null）
      currentBalance: null,   // 現在の残高（まだ未設定 = null）
      nextIncomeDate: null,   // 次回収入日
      expenses: [],           // 支出の一覧
      incomes: [],            // 収入の一覧
      recurringExpenses: [],  // 定期支出の一覧
      balanceAdjustments: [], // 残高修正履歴
      nextExpenseId: 1,       // 次に支出へ割り振るID番号
      nextRecurringExpenseId: 1, // 次に定期支出へ割り振るID番号
      nextIncomeId: 1,        // 次に収入へ割り振るID番号
      nextBalanceAdjustmentId: 1 // 次に残高修正履歴へ割り振るID番号
    };
  }

  // 保存データがある場合は、文字列(JSON)をオブジェクトに変換する
  const data = JSON.parse(savedText);

  // ------------------------------------------------------------
  // 【マイグレーション処理】
  // 以前のバージョンで保存されたデータには nextExpenseId や
  // 各支出のid が無い場合がある（後から追加した項目のため）。
  // その場合はここで補ってあげることで、古いデータも壊さずに使い続けられるようにする。
  // ------------------------------------------------------------
  if (data.nextExpenseId === undefined) {
    data.nextExpenseId = 1;
  }

  data.expenses.forEach(function (expense) {
    if (expense.id === undefined) {
      expense.id = data.nextExpenseId;
      data.nextExpenseId += 1;
    }
  });

  // 定期支出についても、支出のときと同じ考え方でマイグレーションする
  if (data.nextRecurringExpenseId === undefined) {
    data.nextRecurringExpenseId = 1;
  }

  data.recurringExpenses.forEach(function (recurring) {
    if (recurring.id === undefined) {
      recurring.id = data.nextRecurringExpenseId;
      data.nextRecurringExpenseId += 1;
    }
  });

  // 収入についても、支出のときと同じ考え方でマイグレーションする
  if (data.nextIncomeId === undefined) {
    data.nextIncomeId = 1;
  }

  data.incomes.forEach(function (income) {
    if (income.id === undefined) {
      income.id = data.nextIncomeId;
      data.nextIncomeId += 1;
    }
  });

  // 残高修正履歴が無い古いデータには、空の状態を補う
  if (data.balanceAdjustments === undefined) {
    data.balanceAdjustments = [];
  }

  if (data.nextBalanceAdjustmentId === undefined) {
    data.nextBalanceAdjustmentId = 1;
  }

  return data;
}


// データを保存する関数
// 引数 data には、loadData()で取得した形と同じオブジェクトを渡す
function saveData(data) {
  // オブジェクトはそのままでは保存できないので、文字列(JSON)に変換してから保存する
  const dataText = JSON.stringify(data);
  localStorage.setItem(STORAGE_KEY, dataText);
}

// 今のデータをJSONファイルとして書き出す関数
// 「バックアップを書き出す」ボタンが押されたときに呼ばれる
function exportBackupData() {
  const data = loadData();

  // 人が見ても読みやすいように、改行・インデント付きのJSON文字列に変換する
  const dataText = JSON.stringify(data, null, 2);

  // ファイルの中身（Blob）を作る
  const blob = new Blob([dataText], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  // ファイル名に今日の日付を入れる（例：easemoney_backup_20260821.json）
  const todayText = getTodayDateString().replace(/-/g, "");
  const fileName = "easemoney_backup_" + todayText + ".json";

  // 画面に見えない<a>タグを一時的に作り、クリックさせることでダウンロードを実行する
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  // 使い終わったURLは解放しておく
  URL.revokeObjectURL(url);
}

// バックアップファイルを読み込んで、今のデータを上書きする関数
// 「バックアップを読み込む」でファイルが選ばれたときに呼ばれる
// 引数 file には、選択されたファイル（Fileオブジェクト）を渡す
function importBackupData(file) {
  const reader = new FileReader();

  // ファイルの読み込みが終わったときの処理
  reader.onload = function (event) {
    const fileText = event.target.result;

    // チェック①：ファイルの中身が正しいJSON形式かどうか
    let importedData;
    try {
      importedData = JSON.parse(fileText);
    } catch (error) {
      alert("このファイルは読み込めませんでした。バックアップファイル（.json）を選んでください。");
      return;
    }

    // チェック②：Ease Moneyのバックアップファイルとして最低限必要な項目があるか
    const hasRequiredFields =
      Array.isArray(importedData.expenses) &&
      Array.isArray(importedData.incomes) &&
      Array.isArray(importedData.recurringExpenses);

    if (!hasRequiredFields) {
      alert("このファイルはEase Moneyのバックアップファイルではないようです。");
      return;
    }

    // 上書きしてよいか、必ず確認する
    const isConfirmed = confirm(
      "現在のデータをすべて、このバックアップファイルの内容で上書きします。\n" +
      "この操作は取り消せません。よろしいですか？"
    );

    if (!isConfirmed) {
      return;
    }

    // データを保存する
    saveData(importedData);

    alert("バックアップを読み込みました。画面を更新します。");

    // 画面のあらゆる表示（残高・カレンダーなど）に反映させるため、ページごと再読み込みする
    location.reload();
  };

  reader.readAsText(file);
}

// 画面上の「現在の残高」表示を更新する関数
// 「設定」画面と「ホーム」画面の2箇所に同じ残高を表示しているので、両方まとめて更新する
function updateBalanceDisplay(data) {
  const displayText = data.currentBalance === null
    ? "未登録"
    : data.currentBalance.toLocaleString() + " 円"; // toLocaleString()で数字に自動でカンマが付く

  document.getElementById("balance-display").textContent = displayText;      // 設定画面
  document.getElementById("home-balance-display").textContent = displayText; // ホーム画面
}


// 日付の文字列（例: "2026-09-01"）を「2026年9月1日」という表示用の文字列に変換する関数
//
// 【なぜ new Date() を使わないのか】
// JavaScriptの Date は「時刻」も一緒に扱う仕組みで、住んでいる地域（タイムゾーン）によって
// 計算結果がズレることがある（例：日本では9/1のはずが8/31と表示されてしまう、など）。
// 今回は日付（年・月・日）だけを扱いたいので、文字列を "-" で分割するだけの
// シンプルな方法を使い、そのズレが起きないようにしている。
function formatDateJapanese(dateString) {
  const parts = dateString.split("-"); // "2026-09-01" → ["2026", "09", "01"]
  const year = parts[0];
  const month = Number(parts[1]); // Number()で変換すると先頭の0が消える（"09" → 9）
  const day = Number(parts[2]);
  return year + "年" + month + "月" + day + "日";
}


// 残高修正履歴の一覧を画面に表示する関数
// 新しい修正が上に来るように、配列を逆順にしてから表示する
function renderBalanceAdjustmentList(data) {
  const listElement = document.getElementById("balance-adjustment-list");
  listElement.innerHTML = "";

  // slice()で配列のコピーを作ってからreverse()する
  // （元のdata.balanceAdjustmentsの並び順（登録した順）を壊さないようにするため）
  const reversedList = data.balanceAdjustments.slice().reverse();

  reversedList.forEach(function (adjustment) {
    const itemElement = document.createElement("li");
    itemElement.textContent =
      formatDateJapanese(adjustment.date) + "：" +
      adjustment.oldBalance.toLocaleString() + "円 → " +
      adjustment.newBalance.toLocaleString() + "円";
    listElement.appendChild(itemElement);
  });
}


// 画面上の「次回収入日」表示を更新する関数
function updateIncomeDateDisplay(data) {
  const displayElement = document.getElementById("income-date-display");

  if (data.nextIncomeDate === null) {
    displayElement.textContent = "未登録";
  } else {
    displayElement.textContent = formatDateJapanese(data.nextIncomeDate);
  }
}


// ============================================================
// 【支出カテゴリの一覧について】
// キー（左側）が第一階層、値の配列（右側）が第二階層。
// 第二階層が無いカテゴリ（日用品）は空の配列 [] にしてある。
// ============================================================
const CATEGORY_MAP = {
  "🍚 食費": ["食料品", "外食", "デリバリー"],
  "🧻 日用品": [],
  "💡 光熱費": ["水道", "ガス", "電気"],
  "📱 通信": ["機種代", "回線代", "WiFi代"],
  "🏥 医療": ["病院代", "薬代", "医薬品代"],
  "🐶 ペット": ["日用品", "病院", "トリミング"],
  "🎮 娯楽": ["ゲーム", "映画", "本"],
  "📦 その他": ["交通費", "衣類", "プレゼント", "教育", "美容", "交際費", "家具/家電", "特別支出"]
};


// 今日の日付を "YYYY-MM-DD" の形式で取得する関数（<input type="date">に入れる値として使う）
//
// 【formatDateJapanese()と違い、ここでは new Date() を使っている理由】
// 今回は「今この瞬間のパソコン・スマホの日付」を知りたいので、Dateオブジェクトを使う必要がある。
// getFullYear() / getMonth() / getDate() は「使っている端末のローカル時間」を基準に
// 年・月・日を返してくれるメソッドなので、タイムゾーンのズレは起きない。
// （ズレが起きるのは、日付を「文字列 ⇔ Date」で変換し直すときなので、そこだけ注意すればよい）
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0"); // 月は0始まりなので+1する
  const day = String(today.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}


// カテゴリの第一階層の選択肢を、CATEGORY_MAPの内容から自動的に作る関数
// selectElementId には、選択肢を入れたい<select>のidを渡す
// （支出登録フォームと定期支出フォームの両方から、この同じ関数を呼び出して使う）
function populateMainCategoryOptions(selectElementId) {
  const selectElement = document.getElementById(selectElementId);

  // 一番上に「未選択」の選択肢を追加する
  selectElement.innerHTML = '<option value="">選択してください</option>';

  // CATEGORY_MAPのキー（カテゴリ名）を1つずつ取り出して、選択肢として追加する
  for (const categoryName in CATEGORY_MAP) {
    const optionElement = document.createElement("option");
    optionElement.value = categoryName;
    optionElement.textContent = categoryName;
    selectElement.appendChild(optionElement);
  }
}


// 選ばれた第一階層に応じて、第二階層の選択肢を作り直す関数
// selectElementId には、選択肢を入れたい<select>のidを渡す
function updateSubCategoryOptions(selectedMainCategory, selectElementId) {
  const selectElement = document.getElementById(selectElementId);

  // 一番上に「選択しない」の選択肢を追加する（第二階層は任意のため）
  selectElement.innerHTML = '<option value="">選択しない</option>';

  // まだ第一階層が選ばれていない場合は、ここで終了
  if (selectedMainCategory === "") {
    return;
  }

  const subCategoryList = CATEGORY_MAP[selectedMainCategory];

  subCategoryList.forEach(function (subCategoryName) {
    const optionElement = document.createElement("option");
    optionElement.value = subCategoryName;
    optionElement.textContent = subCategoryName;
    selectElement.appendChild(optionElement);
  });
}


// ============================================================
// 【履歴（カレンダー）関連】
// ============================================================

// 現在カレンダーに表示している年・月
// （script.js内のどこからでも参照できるように、関数の外側で定義している）
let calendarYear;
let calendarMonth; // 0=1月, 11=12月（JavaScriptのDateの数え方に合わせている）

// 現在編集中の支出のID番号。編集していないときは null
let editingExpenseId = null;


// カレンダーを組み立てて画面に表示する関数
function renderCalendar(data) {
  // 見出し（例: 2026年9月）を更新する
  document.getElementById("calendar-month-label").textContent =
    calendarYear + "年" + (calendarMonth + 1) + "月";

  const gridElement = document.getElementById("calendar-grid");
  gridElement.innerHTML = "";

  // 曜日の見出し行（日・月・火・水・木・金・土）を作る
  const weekdayNames = ["日", "月", "火", "水", "木", "金", "土"];
  weekdayNames.forEach(function (name) {
    const headerCell = document.createElement("div");
    headerCell.className = "calendar-weekday";
    headerCell.textContent = name;
    gridElement.appendChild(headerCell);
  });

  // この月の1日が何曜日か（0=日曜 ... 6=土曜）
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
  const firstWeekday = firstDayOfMonth.getDay();

  // この月が何日まであるか
  // 「翌月の0日目」を指定すると、今月の最終日が求まるというDateの仕様を利用している
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

  // 1日より前は空白マスで埋める（曜日の位置を合わせるため）
  for (let i = 0; i < firstWeekday; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day calendar-day-empty";
    gridElement.appendChild(emptyCell);
  }

  let monthTotal = 0;
  let monthIncomeTotal = 0;

  // 1日から月末まで、1日ずつマスを作る
  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(calendarMonth + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    const dateString = calendarYear + "-" + monthStr + "-" + dayStr;

    // この日の支出だけを取り出す
    const dayExpenses = data.expenses.filter(function (expense) {
      return expense.date === dateString;
    });

    let dayTotal = 0;
    dayExpenses.forEach(function (expense) {
      dayTotal += expense.amount;
    });

    monthTotal += dayTotal;

    // この日の収入だけを取り出す
    const dayIncomes = data.incomes.filter(function (income) {
      return income.date === dateString;
    });

    let dayIncomeTotal = 0;
    dayIncomes.forEach(function (income) {
      dayIncomeTotal += income.amount;
    });

    monthIncomeTotal += dayIncomeTotal;

    const dayCell = document.createElement("div");
    dayCell.className = "calendar-day";

    const dayNumberElement = document.createElement("div");
    dayNumberElement.className = "calendar-day-number";
    dayNumberElement.textContent = day;
    dayCell.appendChild(dayNumberElement);

    // 支出がある日だけ、合計金額と件数を表示する（赤）
    if (dayExpenses.length > 0) {
      const dayInfoElement = document.createElement("div");
      dayInfoElement.className = "calendar-day-info";
      dayInfoElement.textContent = dayTotal.toLocaleString() + "円(" + dayExpenses.length + "件)";
      dayCell.appendChild(dayInfoElement);
    }

    // 収入がある日だけ、合計金額と件数を表示する（緑）
    if (dayIncomes.length > 0) {
      const dayIncomeInfoElement = document.createElement("div");
      dayIncomeInfoElement.className = "calendar-day-income-info";
      dayIncomeInfoElement.textContent = "+" + dayIncomeTotal.toLocaleString() + "円(" + dayIncomes.length + "件)";
      dayCell.appendChild(dayIncomeInfoElement);
    }

    // 日付マスをクリックすると、その日の詳細を表示する
    dayCell.addEventListener("click", function () {
      showDayDetail(dateString, data);
    });

    gridElement.appendChild(dayCell);
  }

  // 今月の支出合計・収入合計を表示する
  document.getElementById("month-total-display").textContent = monthTotal.toLocaleString() + "円";
  document.getElementById("month-income-total-display").textContent = monthIncomeTotal.toLocaleString() + "円";

  // 月を切り替えたときに、前の月で開いていた詳細表示は閉じておく
  document.getElementById("day-detail-section").style.display = "none";
}


// 指定した日付の支出・収入の詳細を表示する関数
function showDayDetail(dateString, data) {
  const detailSection = document.getElementById("day-detail-section");
  const titleElement = document.getElementById("day-detail-title");
  const expenseListElement = document.getElementById("day-detail-expense-list");
  const incomeListElement = document.getElementById("day-detail-income-list");

  titleElement.textContent = formatDateJapanese(dateString);

  // --- 支出のリストを作る ---
  expenseListElement.innerHTML = "";

  const dayExpenses = data.expenses.filter(function (expense) {
    return expense.date === dateString;
  });

  if (dayExpenses.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "この日の支出はありません";
    expenseListElement.appendChild(emptyItem);
  } else {
    dayExpenses.forEach(function (expense) {
      const itemElement = document.createElement("li");

      // 支出の内容を表示するテキスト部分
      const textElement = document.createElement("span");
      let text = expense.categoryMain;
      if (expense.categorySub !== "") {
        text += " - " + expense.categorySub;
      }
      text += "／" + expense.amount.toLocaleString() + "円";
      if (expense.memo !== "") {
        text += "／" + expense.memo;
      }
      textElement.textContent = text;

      // 編集ボタン（このボタンだけの支出IDを覚えておくため、クロージャで expense.id を使う）
      const editButton = document.createElement("button");
      editButton.textContent = "編集";
      editButton.className = "expense-edit-button";
      editButton.addEventListener("click", function () {
        startEditingExpense(expense.id);
      });

      // 削除ボタン
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "削除";
      deleteButton.className = "expense-delete-button";
      deleteButton.addEventListener("click", function () {
        deleteExpense(expense.id);
      });

      itemElement.appendChild(textElement);
      itemElement.appendChild(editButton);
      itemElement.appendChild(deleteButton);
      expenseListElement.appendChild(itemElement);
    });
  }

  // --- 収入のリストを作る ---
  incomeListElement.innerHTML = "";

  const dayIncomes = data.incomes.filter(function (income) {
    return income.date === dateString;
  });

  if (dayIncomes.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "この日の収入はありません";
    incomeListElement.appendChild(emptyItem);
  } else {
    dayIncomes.forEach(function (income) {
      const itemElement = document.createElement("li");

      const textElement = document.createElement("span");
      let text = income.type + "／" + income.amount.toLocaleString() + "円";
      if (income.memo !== "") {
        text += "／" + income.memo;
      }
      textElement.textContent = text;

      const editButton = document.createElement("button");
      editButton.textContent = "編集";
      editButton.className = "income-edit-button";
      editButton.addEventListener("click", function () {
        startEditingIncome(income.id);
      });

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "削除";
      deleteButton.className = "income-delete-button";
      deleteButton.addEventListener("click", function () {
        deleteIncome(income.id);
      });

      itemElement.appendChild(textElement);
      itemElement.appendChild(editButton);
      itemElement.appendChild(deleteButton);
      incomeListElement.appendChild(itemElement);
    });
  }

  detailSection.style.display = "block";
}


// 指定したIDの支出を、支出登録フォームに読み込んで「編集モード」にする関数
function startEditingExpense(expenseId) {
  const data = loadData();
  const expense = data.expenses.find(function (e) {
    return e.id === expenseId;
  });

  // 万が一データが見つからなかった場合は、何もせず終了する（通常は起こらない想定）
  if (expense === undefined) {
    return;
  }

  editingExpenseId = expenseId;

  document.getElementById("expense-date-input").value = expense.date;
  document.getElementById("expense-amount-input").value = expense.amount;

  const categoryMainSelect = document.getElementById("expense-category-main");
  categoryMainSelect.value = expense.categoryMain;

  // 第一階層の内容に合わせて、第二階層の選択肢を作り直してから値をセットする
  updateSubCategoryOptions(expense.categoryMain, "expense-category-sub");
  document.getElementById("expense-category-sub").value = expense.categorySub;

  document.getElementById("expense-memo-input").value = expense.memo;

  // ボタンの見た目を「編集モード」に切り替える
  document.getElementById("save-expense-button").textContent = "支出を更新";
  document.getElementById("cancel-edit-button").style.display = "inline";

  // 「支出」画面に切り替える（履歴画面から編集を始めた場合、フォームが見えるようにするため）
  showScreen("expense");
}


// 編集モードを終了し、支出登録フォームを「新規登録」の初期状態に戻す関数
function cancelEditingExpense() {
  editingExpenseId = null;

  document.getElementById("expense-date-input").value = getTodayDateString();
  document.getElementById("expense-amount-input").value = "";
  document.getElementById("expense-category-main").value = "";
  updateSubCategoryOptions("", "expense-category-sub");
  document.getElementById("expense-memo-input").value = "";

  document.getElementById("save-expense-button").textContent = "支出を登録";
  document.getElementById("cancel-edit-button").style.display = "none";
}


// 指定したIDの支出を削除する関数
function deleteExpense(expenseId) {
  const confirmed = confirm("この支出を削除しますか？");
  if (!confirmed) {
    return;
  }

  const latestData = loadData();
  const targetIndex = latestData.expenses.findIndex(function (e) {
    return e.id === expenseId;
  });

  // 万が一データが見つからなかった場合は、何もせず終了する
  if (targetIndex === -1) {
    return;
  }

  const deletedExpense = latestData.expenses[targetIndex];

  // 削除する支出の金額を、残高に戻す
  latestData.currentBalance = latestData.currentBalance + deletedExpense.amount;

  // 配列からこの支出を1件取り除く
  latestData.expenses.splice(targetIndex, 1);

  saveData(latestData);

  // ちょうど編集中だった支出を削除した場合に備えて、編集モードを解除しておく
  cancelEditingExpense();

  updateBalanceDisplay(latestData);
  renderCalendar(latestData); // カレンダーを再表示する（詳細パネルは自動的に閉じる）
  updateWeeklySummaryDisplay(latestData);
}


// ============================================================
// 【収入関連】支出のときと同じ考え方で作っている
// ============================================================

// 現在編集中の収入のID番号。編集していないときは null
let editingIncomeId = null;


// 指定したIDの収入を、収入登録フォームに読み込んで「編集モード」にする関数
function startEditingIncome(incomeId) {
  const data = loadData();
  const income = data.incomes.find(function (i) {
    return i.id === incomeId;
  });

  if (income === undefined) {
    return;
  }

  editingIncomeId = incomeId;

  document.getElementById("income-entry-date-input").value = income.date;
  document.getElementById("income-entry-amount-input").value = income.amount;
  document.getElementById("income-entry-type-select").value = income.type;
  document.getElementById("income-entry-memo-input").value = income.memo;

  document.getElementById("save-income-entry-button").textContent = "収入を更新";
  document.getElementById("cancel-income-edit-button").style.display = "inline";

  // 「収入」画面に切り替える（履歴画面から編集を始めた場合、フォームが見えるようにするため）
  showScreen("income");
}


// 編集モードを終了し、収入登録フォームを「新規登録」の初期状態に戻す関数
function cancelEditingIncome() {
  editingIncomeId = null;

  document.getElementById("income-entry-date-input").value = getTodayDateString();
  document.getElementById("income-entry-amount-input").value = "";
  document.getElementById("income-entry-type-select").value = "";
  document.getElementById("income-entry-memo-input").value = "";

  document.getElementById("save-income-entry-button").textContent = "収入を登録";
  document.getElementById("cancel-income-edit-button").style.display = "none";
}


// 指定したIDの収入を削除する関数
function deleteIncome(incomeId) {
  const confirmed = confirm("この収入を削除しますか？");
  if (!confirmed) {
    return;
  }

  const latestData = loadData();
  const targetIndex = latestData.incomes.findIndex(function (i) {
    return i.id === incomeId;
  });

  if (targetIndex === -1) {
    return;
  }

  const deletedIncome = latestData.incomes[targetIndex];

  // 削除する収入の金額を、残高から差し引く（収入を無かったことにするため）
  latestData.currentBalance = latestData.currentBalance - deletedIncome.amount;

  latestData.incomes.splice(targetIndex, 1);

  saveData(latestData);

  // ちょうど編集中だった収入を削除した場合に備えて、編集モードを解除しておく
  cancelEditingIncome();

  updateBalanceDisplay(latestData);
  renderCalendar(latestData);
  updateWeeklySummaryDisplay(latestData);
}


// ============================================================
// 【今日使える目安の計算に使う、日付の補助関数】
// ============================================================

// "2026-09-01" のような日付文字列を、Dateオブジェクトに変換する関数
//
// 【なぜ new Date("2026-09-01") と直接書かないのか】
// new Date(文字列) は内部でUTC（世界標準時）として解釈されるため、
// 日本時間ではズレて1日前の日付になってしまうことがある。
// ここでは year, month, day を1つずつ渡す書き方 new Date(year, month, day) を使う。
// この書き方は「使っている端末のローカル時間」で日付を作ってくれるので、ズレが起きない。
function parseDateString(dateString) {
  const parts = dateString.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1; // Dateの月は0始まり（0=1月）なので-1する
  const day = Number(parts[2]);
  return new Date(year, month, day);
}


// 2つの日付（Dateオブジェクト）の間が何日離れているかを計算する関数
// 例：dateAが9/1、dateBが9/4なら 3 を返す
function daysBetween(dateA, dateB) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.round((dateB.getTime() - dateA.getTime()) / millisecondsPerDay);
}


// 指定した日付が含まれる週の「日曜日」を求める関数
function getStartOfWeek(dateObj) {
  const result = new Date(dateObj);
  // getDay()は 日曜=0, 月曜=1, ... 土曜=6 を返す
  result.setDate(dateObj.getDate() - dateObj.getDay());
  return result;
}


// 指定した日付が含まれる週の「土曜日」を求める関数
function getEndOfWeek(dateObj) {
  const result = new Date(dateObj);
  result.setDate(dateObj.getDate() + (6 - dateObj.getDay()));
  return result;
}


// 「今週の利用状況」エリアの表示を更新する関数
function updateWeeklySummaryDisplay(data) {
  const messageElement = document.getElementById("weekly-summary-message");
  const detailsElement = document.getElementById("weekly-summary-details");

  // --- 前提条件のチェック：足りない情報があれば、案内メッセージだけ表示して終了する ---

  if (data.nextIncomeDate === null) {
    messageElement.textContent = "次回収入日を登録してください";
    detailsElement.style.display = "none";
    return;
  }

  if (data.currentBalance === null) {
    messageElement.textContent = "残高を登録してください";
    detailsElement.style.display = "none";
    return;
  }

  const today = parseDateString(getTodayDateString());
  const nextIncome = parseDateString(data.nextIncomeDate);
  const daysUntilIncome = daysBetween(today, nextIncome);

  // 次回収入日が今日、または過ぎている場合
  if (daysUntilIncome <= 0) {
    messageElement.textContent = "次回収入日を過ぎています。次回収入日を更新してください";
    detailsElement.style.display = "none";
    return;
  }

  // --- ここまで来たら、計算に必要な情報はすべて揃っている ---
  messageElement.textContent = "";
  detailsElement.style.display = "block";

  // 「次回収入日の前日」を先に求めておく（定期支出の予測にも使うため）
  const dayBeforeIncome = new Date(nextIncome);
  dayBeforeIncome.setDate(nextIncome.getDate() - 1);

  // 次回収入日までに発生する見込みの定期支出を合計する
  // （今日発生する分はアプリ起動時にすでに残高へ反映済みなので、
  // 　ここでは「今日より後」に発生する予定の分だけを数える）
  let upcomingRecurringTotal = 0;
  data.recurringExpenses.forEach(function (recurring) {
    const nextDate = getNextRecurringDate(recurring, today);
    if (nextDate <= dayBeforeIncome) {
      upcomingRecurringTotal += recurring.amount;
    }
  });

  // 次回収入までに使える金額 = 現在の残高 - これから発生する定期支出
  const availableAmount = data.currentBalance - upcomingRecurringTotal;

  // 1日に使える金額（設計書：次回収入までに使える金額 ÷ 次回収入までの残り日数）
  // Math.floor()で切り捨てているのは、使いすぎを防ぐため（多めに見積もらないようにする）
  const dailyAmount = Math.floor(availableAmount / daysUntilIncome);

  // 「今週使える目安」の対象期間は、「土曜日」と「次回収入日の前日」の早い方まで
  const endOfWeek = getEndOfWeek(today);

  const effectiveEndDate = dayBeforeIncome < endOfWeek ? dayBeforeIncome : endOfWeek;
  const daysThisWeek = daysBetween(today, effectiveEndDate) + 1; // 今日の分も数えるので+1

  const weeklyBudget = dailyAmount * daysThisWeek;

  // 今週（日〜土）に登録された支出の合計を計算する
  const startOfWeek = getStartOfWeek(today);
  let weeklySpent = 0;

  data.expenses.forEach(function (expense) {
    const expenseDate = parseDateString(expense.date);
    if (expenseDate >= startOfWeek && expenseDate <= endOfWeek) {
      weeklySpent += expense.amount;
    }
  });

  const remaining = weeklyBudget - weeklySpent;

  // 画面に反映する
  document.getElementById("weekly-budget-display").textContent = weeklyBudget.toLocaleString() + "円";
  document.getElementById("weekly-spent-display").textContent = weeklySpent.toLocaleString() + "円";
  document.getElementById("weekly-remaining-display").textContent = remaining.toLocaleString() + "円";
  document.getElementById("days-until-income-display").textContent = "あと" + daysUntilIncome + "日";
}


// ============================================================
// 【定期支出関連】
// ============================================================

// 指定した年月の最終日を求める関数（例: 2026年2月 → 28）
function getLastDayOfMonth(year, month) {
  // 「翌月の0日目」を指定すると、その月の最終日が求まるというDateの仕様を利用している
  return new Date(year, month + 1, 0).getDate();
}


// 定期支出の「指定した年月における引き落とし日」を求める関数
// dayOfMonthがその月に存在しない日（31日など）の場合は、その月の最終日に繰り下げる
function getDebitDateInMonth(recurring, year, month) {
  const lastDay = getLastDayOfMonth(year, month);
  const day = Math.min(recurring.dayOfMonth, lastDay);
  return new Date(year, month, day);
}


// 指定した日付（afterDate）より後で、直近の引き落とし日を求める関数
// 「今週の利用目安」の計算で、これから発生する定期支出を予測するために使う
function getNextRecurringDate(recurring, afterDate) {
  let year = afterDate.getFullYear();
  let month = afterDate.getMonth();

  const thisMonthDate = getDebitDateInMonth(recurring, year, month);
  if (thisMonthDate > afterDate) {
    return thisMonthDate;
  }

  // 今月の引き落とし日はもう過ぎているので、来月の引き落とし日を返す
  month += 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }
  return getDebitDateInMonth(recurring, year, month);
}


// 登録されている定期支出をチェックし、引き落とし日を過ぎているものを
// 通常の支出として自動的に記録する関数
//
// 【しばらくアプリを開いていなかった場合について】
// 「前回記録した月の翌月」から「今月」まで、1ヶ月ずつ順番にチェックしていくので、
// 数ヶ月分たまっていても、開いたタイミングでまとめて記録される。
//
// 戻り値：1件でも記録した場合はtrue（呼び出し側で保存が必要かどうかの判断に使う）
function processRecurringExpenses(data) {
  // 残高が未登録の場合は、まだ計算のしようがないので何もしない
  if (data.currentBalance === null) {
    return false;
  }

  const today = parseDateString(getTodayDateString());
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  let didGenerate = false;

  data.recurringExpenses.forEach(function (recurring) {
    // チェックを始める年月を決める
    let checkYear;
    let checkMonth;

    if (recurring.lastGeneratedYearMonth === null) {
      // まだ一度も記録していない場合は、登録された月（＝今月）からチェックを始める
      checkYear = currentYear;
      checkMonth = currentMonth;
    } else {
      const parts = recurring.lastGeneratedYearMonth.split("-");
      checkYear = Number(parts[0]);
      checkMonth = Number(parts[1]) - 1; // 前回記録した月
      checkMonth += 1;                   // その「次の月」からチェックする
      if (checkMonth > 11) {
        checkMonth = 0;
        checkYear += 1;
      }
    }

    // checkYear/checkMonth から 今年今月まで、1ヶ月ずつ確認する
    while (checkYear < currentYear || (checkYear === currentYear && checkMonth <= currentMonth)) {
      const debitDate = getDebitDateInMonth(recurring, checkYear, checkMonth);

      // その月の引き落とし日が「今日以前」になっていれば、支出として確定する
      if (debitDate <= today) {
        const monthStr = String(checkMonth + 1).padStart(2, "0");
        const dayStr = String(debitDate.getDate()).padStart(2, "0");
        const dateString = checkYear + "-" + monthStr + "-" + dayStr;

        const newExpense = {
          id: data.nextExpenseId,
          date: dateString,
          amount: recurring.amount,
          categoryMain: recurring.category, // 「家賃」または「サブスク」がそのまま入る
          categorySub: "",                  // 定期支出にサブカテゴリは無い
          memo: "（定期支出）" + recurring.name
        };
        data.nextExpenseId += 1;
        data.expenses.push(newExpense);
        data.currentBalance = data.currentBalance - recurring.amount;

        recurring.lastGeneratedYearMonth = checkYear + "-" + String(checkMonth + 1).padStart(2, "0");
        didGenerate = true;
      }

      // 次の月へ
      checkMonth += 1;
      if (checkMonth > 11) {
        checkMonth = 0;
        checkYear += 1;
      }
    }
  });

  return didGenerate;
}


// 登録済みの定期支出一覧を画面に表示する関数
function renderRecurringList(data) {
  const listElement = document.getElementById("recurring-list");
  listElement.innerHTML = "";

  data.recurringExpenses.forEach(function (recurring) {
    const itemElement = document.createElement("li");

    const textElement = document.createElement("span");
    const text = recurring.name + "／毎月" + recurring.dayOfMonth + "日／" +
      recurring.amount.toLocaleString() + "円／" + recurring.category;
    textElement.textContent = text;

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";
    deleteButton.className = "recurring-delete-button";
    deleteButton.addEventListener("click", function () {
      deleteRecurringExpense(recurring.id);
    });

    itemElement.appendChild(textElement);
    itemElement.appendChild(deleteButton);
    listElement.appendChild(itemElement);
  });
}


// 指定したIDの定期支出「設定」を削除する関数
// 過去に自動生成された支出（data.expenses側のデータ）はここでは一切変更しない
function deleteRecurringExpense(recurringId) {
  const confirmed = confirm("この定期支出の設定を削除しますか？（すでに記録された支出履歴は残ります）");
  if (!confirmed) {
    return;
  }

  const latestData = loadData();
  const targetIndex = latestData.recurringExpenses.findIndex(function (r) {
    return r.id === recurringId;
  });

  if (targetIndex === -1) {
    return;
  }

  latestData.recurringExpenses.splice(targetIndex, 1);
  saveData(latestData);

  renderRecurringList(latestData);
}


// ============================================================
// ページの読み込みが完了したタイミングで、この中身が実行される
// ============================================================
window.onload = function () {

  // --- STEP1で作った動作確認メッセージ ---
  document.getElementById("status-message").textContent = "✅ 正常に動いています！";

  // --- 保存されているデータを読み込んで、画面に反映する ---
  const data = loadData();

  // --- 定期支出の自動反映（引き落とし日を過ぎているものを、通常の支出として記録する） ---
  const generatedExpense = processRecurringExpenses(data);
  if (generatedExpense) {
    saveData(data); // 新しく支出が生成された場合のみ、保存し直す
  }

  updateBalanceDisplay(data);
  updateIncomeDateDisplay(data);
  updateWeeklySummaryDisplay(data);
  renderBalanceAdjustmentList(data); // 残高修正履歴を表示する

  // --- 支出フォームの初期化 ---
  populateMainCategoryOptions("expense-category-main");       // カテゴリ第一階層の選択肢を作る
  updateSubCategoryOptions("", "expense-category-sub");       // カテゴリ第二階層を「選択しない」だけの状態にする
  document.getElementById("expense-date-input").value = getTodayDateString(); // 日付の初期値を今日にする

  // --- 収入フォームの初期化 ---
  document.getElementById("income-entry-date-input").value = getTodayDateString(); // 日付の初期値を今日にする

  // --- 定期支出フォームの初期化 ---
  // カテゴリは固定の2択（家賃・サブスク）をHTMLに直接書いているので、
  // 支出フォームのようなカテゴリ選択肢を作る処理は不要
  renderRecurringList(data);

  // --- 履歴カレンダーの初期化（最初は「今日を含む月」を表示する） ---
  const todayForCalendar = new Date();
  calendarYear = todayForCalendar.getFullYear();
  calendarMonth = todayForCalendar.getMonth();
  renderCalendar(data);

  // 「＜」ボタン：前の月を表示する
  document.getElementById("prev-month-button").addEventListener("click", function () {
    calendarMonth -= 1;
    if (calendarMonth < 0) {
      calendarMonth = 11;
      calendarYear -= 1;
    }
    renderCalendar(loadData());
  });

  // 「＞」ボタン：次の月を表示する
  document.getElementById("next-month-button").addEventListener("click", function () {
    calendarMonth += 1;
    if (calendarMonth > 11) {
      calendarMonth = 0;
      calendarYear += 1;
    }
    renderCalendar(loadData());
  });

  // カテゴリの第一階層が変更されたら、第二階層の選択肢を作り直す（支出フォーム）
  const categoryMainSelect = document.getElementById("expense-category-main");
  categoryMainSelect.addEventListener("change", function () {
    updateSubCategoryOptions(categoryMainSelect.value, "expense-category-sub");
  });

  // --- 「保存」ボタンが押されたときの処理を登録する ---
  const saveButton = document.getElementById("save-balance-button");

  saveButton.addEventListener("click", function () {
    const inputElement = document.getElementById("balance-input");
    const inputValue = inputElement.value;

    // 入力チェック①：何も入力されていない場合は処理を止める
    if (inputValue === "") {
      alert("金額を入力してください");
      return;
    }

    // 入力された文字列を数値に変換する
    const amount = Number(inputValue);

    // 入力チェック②：数値に変換できない場合は処理を止める
    if (Number.isNaN(amount)) {
      alert("正しい金額を入力してください");
      return;
    }

    // 最新のデータを読み込み直してから更新する
    // （画面を開いたままの古いデータを上書きしないようにするため）
    const latestData = loadData();
    latestData.initialBalance = amount;
    latestData.currentBalance = amount;

    // データを保存する
    saveData(latestData);

    // 画面の表示を更新する
    updateBalanceDisplay(latestData);
    updateWeeklySummaryDisplay(latestData);

    // 入力欄を空にする
    inputElement.value = "";
  });

  // --- 「残高を修正」ボタンが押されたときの処理を登録する ---
  const saveAdjustmentButton = document.getElementById("save-balance-adjustment-button");

  saveAdjustmentButton.addEventListener("click", function () {
    const adjustmentInput = document.getElementById("balance-adjustment-input");
    const inputValue = adjustmentInput.value;

    const latestData = loadData();

    // 入力チェック①：まだ残高が登録されていない場合は、修正のしようがないので止める
    if (latestData.currentBalance === null) {
      alert("先に残高を登録してください");
      return;
    }

    // 入力チェック②：何も入力されていない場合は止める
    if (inputValue === "") {
      alert("実際の残高を入力してください");
      return;
    }

    const newBalance = Number(inputValue);

    // 入力チェック③：数値に変換できない場合は止める
    if (Number.isNaN(newBalance)) {
      alert("正しい金額を入力してください");
      return;
    }

    const oldBalance = latestData.currentBalance;

    // 修正履歴を1件作って記録する（この履歴は後から編集・削除できないようにしている）
    const newAdjustment = {
      id: latestData.nextBalanceAdjustmentId,
      date: getTodayDateString(),
      oldBalance: oldBalance,
      newBalance: newBalance
    };
    latestData.nextBalanceAdjustmentId += 1;
    latestData.balanceAdjustments.push(newAdjustment);

    // 現在の残高を、実際の残高に置き換える（初期残高はここでは変更しない）
    latestData.currentBalance = newBalance;

    saveData(latestData);

    // 画面の表示を更新する（今週の利用状況もここで再計算される）
    updateBalanceDisplay(latestData);
    updateWeeklySummaryDisplay(latestData);
    renderBalanceAdjustmentList(latestData);

    alert(
      "残高を修正しました\n" +
      "現在の残高：" + newBalance.toLocaleString() + "円\n" +
      "（今週の利用状況の欄も更新されました）"
    );

    // 入力欄を空にする
    adjustmentInput.value = "";
  });

  // --- 「次回収入日を保存」ボタンが押されたときの処理を登録する ---
  const saveIncomeDateButton = document.getElementById("save-income-date-button");

  saveIncomeDateButton.addEventListener("click", function () {
    const inputElement = document.getElementById("income-date-input");
    const inputValue = inputElement.value; // 例: "2026-09-01"

    // 入力チェック：日付が選ばれていない場合は処理を止める
    if (inputValue === "") {
      alert("日付を選択してください");
      return;
    }

    // 最新のデータを読み込み直してから更新する
    const latestData = loadData();
    latestData.nextIncomeDate = inputValue;

    // データを保存する
    saveData(latestData);

    // 画面の表示を更新する
    updateIncomeDateDisplay(latestData);
    updateWeeklySummaryDisplay(latestData);

    // 入力欄を空にする
    inputElement.value = "";
  });

  // --- 「バックアップを書き出す」ボタンが押されたときの処理を登録する ---
  const exportBackupButton = document.getElementById("export-backup-button");

  exportBackupButton.addEventListener("click", function () {
    exportBackupData();
  });

    // --- 「バックアップを読み込む」ボタンが押されたときの処理を登録する ---
  const importBackupButton = document.getElementById("import-backup-button");
  const importBackupInput = document.getElementById("import-backup-input");

  // ボタンを押したら、見えないファイル選択欄をクリックさせる
  importBackupButton.addEventListener("click", function () {
    importBackupInput.click();
  });

  // ファイルが選ばれたら、読み込み処理を実行する
  importBackupInput.addEventListener("change", function () {
    const selectedFile = importBackupInput.files[0];
    if (selectedFile) {
      importBackupData(selectedFile);
    }
    // 同じファイルを連続で選んでも動くように、選択状態をリセットしておく
    importBackupInput.value = "";
  });

  // --- 「支出を登録」ボタンが押されたときの処理を登録する ---
  const saveExpenseButton = document.getElementById("save-expense-button");

  // --- ☰アイコンが押されたら、メニューの表示・非表示を切り替える ---
  const openMenuButton = document.getElementById("open-menu-button");
  const sideMenu = document.getElementById("side-menu");

  openMenuButton.addEventListener("click", function () {
    if (sideMenu.style.display === "none") {
      sideMenu.style.display = "block";
    } else {
      sideMenu.style.display = "none";
    }
  });

  saveExpenseButton.addEventListener("click", function () {
    // 各入力欄の要素を取得する
    const dateInput = document.getElementById("expense-date-input");
    const amountInput = document.getElementById("expense-amount-input");
    const categoryMainInput = document.getElementById("expense-category-main");
    const categorySubInput = document.getElementById("expense-category-sub");
    const memoInput = document.getElementById("expense-memo-input");

    const dateValue = dateInput.value;
    const amountValue = Number(amountInput.value);
    const categoryMainValue = categoryMainInput.value;
    const categorySubValue = categorySubInput.value;
    const memoValue = memoInput.value;

    // 最新のデータを読み込んでおく（残高が登録済みかのチェックにも使う）
    const latestData = loadData();

    // 入力チェック①：残高が未登録の場合は、支出を引く計算ができないので止める
    if (latestData.currentBalance === null) {
      alert("先に残高を登録してください");
      return;
    }

    // 入力チェック②：日付が選ばれていない場合は止める
    if (dateValue === "") {
      alert("日付を選択してください");
      return;
    }

    // 入力チェック③：金額が0円以下、または未入力（NaN）の場合は止める
    if (amountInput.value === "" || Number.isNaN(amountValue) || amountValue <= 0) {
      alert("金額は1円以上の数字を入力してください");
      return;
    }

    // 入力チェック④：金額が整数でない場合は止める（設計書：小数点なし）
    if (!Number.isInteger(amountValue)) {
      alert("金額は整数で入力してください");
      return;
    }

    // 入力チェック⑤：カテゴリ（第一階層）が選ばれていない場合は止める
    if (categoryMainValue === "") {
      alert("カテゴリを選択してください");
      return;
    }

    // ここまでのチェックを通過したら、editingExpenseIdの値によって処理を分ける
    // editingExpenseIdがnull → 新規登録モード／それ以外 → 更新モード
    if (editingExpenseId === null) {

      // ---------------- 新規登録モード ----------------
      const newExpense = {
        id: latestData.nextExpenseId,  // この支出だけの固有番号
        date: dateValue,
        amount: amountValue,
        categoryMain: categoryMainValue,
        categorySub: categorySubValue, // 未選択の場合は ""（空文字）が入る
        memo: memoValue                // 未入力の場合は ""（空文字）が入る
      };

      // 次に使うID番号を1つ進めておく（次回の登録で重複しないようにするため）
      latestData.nextExpenseId += 1;

      // 支出の一覧に追加する
      latestData.expenses.push(newExpense);

      // 残高から支出額を引く
      latestData.currentBalance = latestData.currentBalance - amountValue;

      saveData(latestData);

      updateBalanceDisplay(latestData);
      renderCalendar(latestData);
      updateWeeklySummaryDisplay(latestData);

      alert("支出を登録しました");
      cancelEditingExpense(); // フォームを初期状態に戻す

    } else {

      // ---------------- 更新（編集）モード ----------------
      const targetIndex = latestData.expenses.findIndex(function (e) {
        return e.id === editingExpenseId;
      });

      // 万が一、編集対象がすでに削除されていた場合は中断する
      if (targetIndex === -1) {
        alert("編集対象の支出が見つかりませんでした");
        cancelEditingExpense();
        return;
      }

      const oldExpense = latestData.expenses[targetIndex];

      // 残高を「古い金額をいったん戻してから、新しい金額を引く」形で計算し直す
      // 例：1,200円だった支出を1,500円に変更した場合、残高からはさらに300円だけ引かれる
      latestData.currentBalance = latestData.currentBalance + oldExpense.amount - amountValue;

      latestData.expenses[targetIndex] = {
        id: editingExpenseId, // IDは変更しない
        date: dateValue,
        amount: amountValue,
        categoryMain: categoryMainValue,
        categorySub: categorySubValue,
        memo: memoValue
      };

      saveData(latestData);

      updateBalanceDisplay(latestData);
      renderCalendar(latestData);
      updateWeeklySummaryDisplay(latestData);

      alert("支出を更新しました");
      cancelEditingExpense(); // フォームを初期状態に戻す
    }
  });

  // --- 「キャンセル」ボタンが押されたときの処理を登録する（編集モードの中断） ---
  const cancelEditButton = document.getElementById("cancel-edit-button");
  cancelEditButton.addEventListener("click", function () {
    cancelEditingExpense();
  });

  // --- 「収入を登録」ボタンが押されたときの処理を登録する ---
  const saveIncomeEntryButton = document.getElementById("save-income-entry-button");

  saveIncomeEntryButton.addEventListener("click", function () {
    const dateInput = document.getElementById("income-entry-date-input");
    const amountInput = document.getElementById("income-entry-amount-input");
    const typeInput = document.getElementById("income-entry-type-select");
    const memoInput = document.getElementById("income-entry-memo-input");

    const dateValue = dateInput.value;
    const amountValue = Number(amountInput.value);
    const typeValue = typeInput.value;
    const memoValue = memoInput.value;

    const latestData = loadData();

    // 入力チェック①：残高が未登録の場合は止める
    if (latestData.currentBalance === null) {
      alert("先に残高を登録してください");
      return;
    }

    // 入力チェック②：日付が選ばれていない場合は止める
    if (dateValue === "") {
      alert("日付を選択してください");
      return;
    }

    // 入力チェック③：金額が0円以下、または未入力の場合は止める
    if (amountInput.value === "" || Number.isNaN(amountValue) || amountValue <= 0) {
      alert("金額は1円以上の数字を入力してください");
      return;
    }

    // 入力チェック④：金額が整数でない場合は止める
    if (!Number.isInteger(amountValue)) {
      alert("金額は整数で入力してください");
      return;
    }

    // 入力チェック⑤：種類が選ばれていない場合は止める
    if (typeValue === "") {
      alert("種類を選択してください");
      return;
    }

    if (editingIncomeId === null) {

      // ---------------- 新規登録モード ----------------
      const newIncome = {
        id: latestData.nextIncomeId,
        date: dateValue,
        amount: amountValue,
        type: typeValue,
        memo: memoValue
      };

      latestData.nextIncomeId += 1;
      latestData.incomes.push(newIncome);

      // 残高に収入額を足す（支出とは逆で「足す」）
      latestData.currentBalance = latestData.currentBalance + amountValue;

      saveData(latestData);

      updateBalanceDisplay(latestData);
      renderCalendar(latestData);
      updateWeeklySummaryDisplay(latestData);

      alert("収入を登録しました");
      cancelEditingIncome(); // フォームを初期状態に戻す

    } else {

      // ---------------- 更新（編集）モード ----------------
      const targetIndex = latestData.incomes.findIndex(function (i) {
        return i.id === editingIncomeId;
      });

      if (targetIndex === -1) {
        alert("編集対象の収入が見つかりませんでした");
        cancelEditingIncome();
        return;
      }

      const oldIncome = latestData.incomes[targetIndex];

      // 残高を「古い金額をいったん取り消してから、新しい金額を足す」形で計算し直す
      latestData.currentBalance = latestData.currentBalance - oldIncome.amount + amountValue;

      latestData.incomes[targetIndex] = {
        id: editingIncomeId, // IDは変更しない
        date: dateValue,
        amount: amountValue,
        type: typeValue,
        memo: memoValue
      };

      saveData(latestData);

      updateBalanceDisplay(latestData);
      renderCalendar(latestData);
      updateWeeklySummaryDisplay(latestData);

      alert("収入を更新しました");
      cancelEditingIncome();
    }
  });

  // --- 「キャンセル」ボタンが押されたときの処理を登録する（収入の編集モードの中断） ---
  const cancelIncomeEditButton = document.getElementById("cancel-income-edit-button");
  cancelIncomeEditButton.addEventListener("click", function () {
    cancelEditingIncome();
  });

  // --- 「定期支出を登録」ボタンが押されたときの処理を登録する ---
  const saveRecurringButton = document.getElementById("save-recurring-button");

  saveRecurringButton.addEventListener("click", function () {
    const nameInput = document.getElementById("recurring-name-input");
    const amountInput = document.getElementById("recurring-amount-input");
    const dayInput = document.getElementById("recurring-day-input");
    const categoryInput = document.getElementById("recurring-category");

    const nameValue = nameInput.value;
    const amountValue = Number(amountInput.value);
    const dayValue = Number(dayInput.value);
    const categoryValue = categoryInput.value;

    // 入力チェック①：名称が空の場合は止める
    if (nameValue === "") {
      alert("名称を入力してください");
      return;
    }

    // 入力チェック②：金額が0円以下、または未入力（NaN）の場合は止める
    if (amountInput.value === "" || Number.isNaN(amountValue) || amountValue <= 0) {
      alert("金額は1円以上の数字を入力してください");
      return;
    }

    // 入力チェック③：金額が整数でない場合は止める
    if (!Number.isInteger(amountValue)) {
      alert("金額は整数で入力してください");
      return;
    }

    // 入力チェック④：引き落とし日が1〜31の整数か確認する
    if (dayInput.value === "" || Number.isNaN(dayValue) || !Number.isInteger(dayValue) || dayValue < 1 || dayValue > 31) {
      alert("引き落とし日は1〜31の数字で入力してください");
      return;
    }

    // 入力チェック⑤：カテゴリ（家賃 or サブスク）が選ばれていない場合は止める
    if (categoryValue === "") {
      alert("カテゴリを選択してください");
      return;
    }

    const latestData = loadData();

    const newRecurring = {
      id: latestData.nextRecurringExpenseId,
      name: nameValue,
      amount: amountValue,
      dayOfMonth: dayValue,
      category: categoryValue,          // 「家賃」または「サブスク」
      lastGeneratedYearMonth: null      // まだ一度も支出として記録していない
    };

    latestData.nextRecurringExpenseId += 1;
    latestData.recurringExpenses.push(newRecurring);

    saveData(latestData);

    renderRecurringList(latestData);

    alert("定期支出を登録しました");

    // フォームをリセットする
    nameInput.value = "";
    amountInput.value = "";
    dayInput.value = "";
    categoryInput.value = "";
  });

  // --- 画面切り替えボタンの処理を登録する ---
  // data-screen属性を持つボタンはすべて対象（下部ナビゲーションバー＋ホーム画面のショートカットボタン）
  document.querySelectorAll("[data-screen]").forEach(function (button) {
    button.addEventListener("click", function () {
      showScreen(button.dataset.screen);
    });
  });

  // --- 最初に表示する画面を「ホーム」にする ---
  showScreen("home");

};