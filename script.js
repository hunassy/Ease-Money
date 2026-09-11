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

  // 確定支出・予想支出の画面に切り替わるときは、直近の実績を反映した平均額を計算し直す
  // （他の画面で支出を登録していても、この画面を開けば必ず最新の状態になるようにするため）
  if (screenName === "recurring") {
    renderEstimatedList(loadData());
  }

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
      recurringExpenses: [],  // 確定支出の一覧
      estimatedExpenses: [],  // 予想支出の一覧
      balanceAdjustments: [], // 残高修正履歴
      nextExpenseId: 1,       // 次に支出へ割り振るID番号
      nextRecurringExpenseId: 1, // 次に確定支出へ割り振るID番号
      nextEstimatedExpenseId: 1, // 次に予想支出へ割り振るID番号
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

  // 【マイグレーション】isRecurringGenerated（確定支出から自動生成されたかどうかの目印）が
  // 無い古いデータには、memoが「（定期支出）」で始まっているかどうかで判定して補う。
  // これにより、この機能追加より前に記録された支出も、正しく「今週使った金額」から除外できる。
  data.expenses.forEach(function (expense) {
    if (expense.isRecurringGenerated === undefined) {
      expense.isRecurringGenerated = expense.memo.indexOf("（定期支出）") === 0;
    }
  });

  // 確定支出についても、支出のときと同じ考え方でマイグレーションする
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

  // 予想支出が無い古いデータには、空の状態を補う
  if (data.estimatedExpenses === undefined) {
    data.estimatedExpenses = [];
  }

  if (data.nextEstimatedExpenseId === undefined) {
    data.nextEstimatedExpenseId = 1;
  }

  // 支払いサイクルが無い古い予想支出データには、「毎月」を補う
  data.estimatedExpenses.forEach(function (estimated) {
    if (estimated.cycleMonths === undefined) {
      estimated.cycleMonths = 1;
    }
  });

  // 「ペット保険」というカテゴリ名を「保険」に変更したことに伴い、
  // 古いデータに残っている表記を新しい名称に合わせる
  data.recurringExpenses.forEach(function (recurring) {
    if (recurring.category === "ペット保険") {
      recurring.category = "保険";
    }
  });

  data.expenses.forEach(function (expense) {
    if (expense.categoryMain === "ペット保険") {
      expense.categoryMain = "保険";
    }
  });

  // 【マイグレーション】支出カテゴリの表記から絵文字を削除したことに伴い、
  // 古いデータに残っている絵文字付きの表記を、新しい絵文字なしの名称に変換する
  const OLD_CATEGORY_NAME_MAP = {
    "🍚 食費": "食費",
    "🧻 日用品": "日用品",
    "💡 光熱費": "光熱費",
    "📱 通信": "通信",
    "🏥 医療": "医療",
    "🐶 ペット": "ペット",
    "🎮 娯楽": "娯楽",
    "📦 その他": "その他"
  };

  data.expenses.forEach(function (expense) {
    if (OLD_CATEGORY_NAME_MAP[expense.categoryMain] !== undefined) {
      expense.categoryMain = OLD_CATEGORY_NAME_MAP[expense.categoryMain];
    }
  });

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
  "食費": ["食料品", "外食", "デリバリー"],
  "日用品": [],
  "光熱費": ["水道", "ガス", "電気"],
  "通信": ["機種代", "回線代", "WiFi代"],
  "医療": ["病院代", "薬代", "医薬品代"],
  "ペット": ["日用品", "病院", "トリミング"],
  "娯楽": ["ゲーム", "映画", "本"],
  "その他": ["交通費", "衣類", "プレゼント", "教育", "美容", "交際費", "家具/家電", "特別支出","返済"]
};

// 確定支出専用の固定カテゴリ一覧（登録フォーム・確定支出一覧・履歴画面の3箇所で共通して使う）
// 1箇所だけ書き換えて他を直し忘れる、というミスを防ぐため、あえて共通の定数にしている
const RECURRING_EXPENSE_CATEGORIES = ["家賃", "サブスク", "保険"];

// 「今週使える目安」の週予算には含めず、残高から直接引くだけにするカテゴリの一覧
// （金額が大きく・不定期に発生するカテゴリをここに追加していく）
const WEEKLY_BUDGET_EXCLUDED_CATEGORIES = ["光熱費", "通信"];

// 予想支出（支払うことは決まっているが、金額が変動するもの）のカテゴリ一覧
const ESTIMATED_EXPENSE_CATEGORIES = ["電気", "ガス", "水道", "機種", "回線", "WiFi"];

// 予想支出のカテゴリ名と、実績支出側のカテゴリ（メイン・内訳）の対応表
// 生活費残高の計算で、「このカテゴリの実績が今月すでに記録されているか」を調べるために使う
const ESTIMATED_EXPENSE_CATEGORY_MAP = {
  "電気": { categoryMain: "光熱費", categorySub: "電気" },
  "ガス": { categoryMain: "光熱費", categorySub: "ガス" },
  "水道": { categoryMain: "光熱費", categorySub: "水道" },
  "機種": { categoryMain: "通信", categorySub: "機種代" },
  "回線": { categoryMain: "通信", categorySub: "回線代" },
  "WiFi": { categoryMain: "通信", categorySub: "WiFi代" }
};

// 支払いサイクル（cycleMonths）の数字を、画面表示用の文字に変換する対応表
const ESTIMATED_EXPENSE_CYCLE_LABELS = {
  1: "毎月",
  2: "2か月ごと",
  3: "3か月ごと"
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
// （支出登録フォームと確定支出フォームの両方から、この同じ関数を呼び出して使う）
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

// 履歴画面：日付詳細パネルで「編集」「削除」ボタンを表示するかどうかの状態
// （通常は非表示にしておき、ボタンを押したときだけ表示する）
let dayDetailEditMode = false;
let dayDetailDeleteMode = false;

// 現在、日付詳細パネルに表示している日付。別の日付に切り替わったときの判定に使う
let currentDayDetailDate = null;

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
  closeDayDetail();
}


// 支出1件分の<li>要素を作る関数（履歴の日付詳細パネルで使う）
// カテゴリ・内訳は見出し側（呼び出し元）で表示するので、ここでは金額とメモだけを表示する
function createExpenseDetailListItem(expense) {
  const itemElement = document.createElement("li");

  const textElement = document.createElement("span");
  let text = expense.amount.toLocaleString() + "円";
  if (expense.memo !== "") {
    text += "／" + expense.memo;
  }
  textElement.textContent = text;
  itemElement.appendChild(textElement);

  // 「編集」ボタンを押して編集モードのときだけ、編集ボタンを表示する
  if (dayDetailEditMode) {
    const editButton = document.createElement("button");
    editButton.textContent = "編集";
    editButton.className = "expense-edit-button";
    editButton.addEventListener("click", function () {
      startEditingExpense(expense.id);
    });
    itemElement.appendChild(editButton);
  }

  // 「削除」ボタンを押して削除モードのときだけ、削除ボタンを表示する
  if (dayDetailDeleteMode) {
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";
    deleteButton.className = "expense-delete-button";
    deleteButton.addEventListener("click", function () {
      deleteExpense(expense.id);
    });
    itemElement.appendChild(deleteButton);
  }

  return itemElement;
}


function showDayDetail(dateString, data) {
  // 別の日付に切り替わったときだけ、編集・削除ボタンの表示状態を初期状態（非表示）に戻す
  // （同じ日付のまま「編集」「削除」ボタンを押してこの関数が呼ばれた場合は、状態を維持する）
  if (currentDayDetailDate !== dateString) {
    dayDetailEditMode = false;
    dayDetailDeleteMode = false;
  }
  currentDayDetailDate = dateString;

  const detailSection = document.getElementById("day-detail-section");
  const titleElement = document.getElementById("day-detail-title");
  const expenseContainerElement = document.getElementById("day-detail-expense-list");
  const incomeListElement = document.getElementById("day-detail-income-list");

  titleElement.textContent = formatDateJapanese(dateString);

  // --- 支出のリストを作る（カテゴリ→内訳の階層で表示する） ---
  expenseContainerElement.innerHTML = "";

  const dayExpenses = data.expenses.filter(function (expense) {
    return expense.date === dateString;
  });

  if (dayExpenses.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "この日の支出はありません";
    expenseContainerElement.appendChild(emptyMessage);
  } else {
    // CATEGORY_MAPに定義されている順番で、カテゴリ（第一階層）ごとにグループ分けする
    for (const categoryMain in CATEGORY_MAP) {
      const itemsInCategory = dayExpenses.filter(function (expense) {
        return expense.categoryMain === categoryMain;
      });

      // このカテゴリに該当する支出が無ければ、見出しごと表示しない
      if (itemsInCategory.length === 0) {
        continue;
      }

      // カテゴリの見出し（第一階層）を追加する
      const categoryHeadingElement = document.createElement("h4");
      categoryHeadingElement.textContent = categoryMain;
      expenseContainerElement.appendChild(categoryHeadingElement);

      // 内訳（第二階層）を選んでいない支出は、見出し無しでカテゴリの直下に並べる
      const itemsWithoutSub = itemsInCategory.filter(function (expense) {
        return expense.categorySub === "";
      });

      if (itemsWithoutSub.length > 0) {
        const noSubListElement = document.createElement("ul");
        itemsWithoutSub.forEach(function (expense) {
          noSubListElement.appendChild(createExpenseDetailListItem(expense));
        });
        expenseContainerElement.appendChild(noSubListElement);
      }

      // 内訳（第二階層）ごとにグループ分けする（CATEGORY_MAPの並び順に沿う）
      const subCategoryList = CATEGORY_MAP[categoryMain];
      subCategoryList.forEach(function (categorySub) {
        const itemsInSub = itemsInCategory.filter(function (expense) {
          return expense.categorySub === categorySub;
        });

        if (itemsInSub.length === 0) {
          return;
        }

        const subHeadingElement = document.createElement("h5");
        subHeadingElement.textContent = categorySub;
        expenseContainerElement.appendChild(subHeadingElement);

              const subListElement = document.createElement("ul");
        itemsInSub.forEach(function (expense) {
          subListElement.appendChild(createExpenseDetailListItem(expense));
        });
        expenseContainerElement.appendChild(subListElement);
      });
    }

    // --- 確定支出（家賃・サブスク・ペット保険）から自動生成された支出は、
    //     CATEGORY_MAPには載っていないカテゴリ名なので、ここで別途表示する ---
    const recurringOriginCategories = RECURRING_EXPENSE_CATEGORIES;

    recurringOriginCategories.forEach(function (categoryMain) {
      const itemsInCategory = dayExpenses.filter(function (expense) {
        return expense.categoryMain === categoryMain;
      });

      if (itemsInCategory.length === 0) {
        return;
      }

      const categoryHeadingElement = document.createElement("h4");
      categoryHeadingElement.textContent = categoryMain;
      expenseContainerElement.appendChild(categoryHeadingElement);

      const listElement = document.createElement("ul");
      itemsInCategory.forEach(function (expense) {
        listElement.appendChild(createExpenseDetailListItem(expense));
      });
      expenseContainerElement.appendChild(listElement);
    });
  }

  // --- 収入のリストを作る（今まで通り、フラットな一覧） ---
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
      itemElement.appendChild(textElement);

      // 「編集」ボタンを押して編集モードのときだけ、編集ボタンを表示する
      if (dayDetailEditMode) {
        const editButton = document.createElement("button");
        editButton.textContent = "編集";
        editButton.className = "income-edit-button";
        editButton.addEventListener("click", function () {
          startEditingIncome(income.id);
        });
        itemElement.appendChild(editButton);
      }

      // 「削除」ボタンを押して削除モードのときだけ、削除ボタンを表示する
      if (dayDetailDeleteMode) {
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "削除";
        deleteButton.className = "income-delete-button";
        deleteButton.addEventListener("click", function () {
          deleteIncome(income.id);
        });
        itemElement.appendChild(deleteButton);
      }

      incomeListElement.appendChild(itemElement);
    });
  }

  detailSection.style.display = "block";
  document.getElementById("day-detail-backdrop").style.display = "block";
}

// 日付詳細のポップアップを閉じる関数
// 「✕」ボタン、または背景（バックドロップ）がクリックされたときに呼ばれる
function closeDayDetail() {
  document.getElementById("day-detail-section").style.display = "none";
  document.getElementById("day-detail-backdrop").style.display = "none";

  // 閉じたので、編集・削除ボタンの表示状態もリセットしておく
  // （次に別の日付を開いたときに、前回の状態が残らないようにするため）
  currentDayDetailDate = null;
  dayDetailEditMode = false;
  dayDetailDeleteMode = false;
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

  // 「支出」画面に先に切り替える（履歴画面から編集を始めた場合、フォームが見えるようにするため）
  // ※ この後の「カテゴリのselectを作り直す処理」より先に画面を切り替えることで、
  // 　 iPhone(iOS Safari)で画面切り替えが反映されない不具合を回避している
  showScreen("expense");

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
  updateLivingCostBalanceDisplay(latestData);
  updateEstimatedReviewNotice(latestData);
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
  updateLivingCostBalanceDisplay(latestData);
  updateEstimatedReviewNotice(latestData);
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

  // 「次回収入日の前日」を先に求めておく（確定支出の予測にも使うため）
  const dayBeforeIncome = new Date(nextIncome);
  dayBeforeIncome.setDate(nextIncome.getDate() - 1);

  // 次回収入日までに発生する見込みの確定支出を合計する
  // （今日発生する分はアプリ起動時にすでに残高へ反映済みなので、
  // 　ここでは「今日より後」に発生する予定の分だけを数える）
  let upcomingRecurringTotal = 0;
  data.recurringExpenses.forEach(function (recurring) {
    // 次回収入日までに、この確定支出が何回発生するかを数える
    // （収入日が2ヶ月以上先になる場合もあるため、1回だけでなく繰り返し数える）
    let occurrenceDate = getNextRecurringDate(recurring, today);
    while (occurrenceDate <= dayBeforeIncome) {
      upcomingRecurringTotal += recurring.amount;
      occurrenceDate = getNextRecurringDate(recurring, occurrenceDate);
    }
  });

  // 次回収入までに使える金額 = 現在の残高 - これから発生する確定支出
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
  // ※ 確定支出（家賃・サブスクなど）は、日割り計算の段階で既に考慮済みのため、
  // 　 ここでの「今週使った金額」には含めない（二重に差し引かれてしまうのを防ぐため）
  const startOfWeek = getStartOfWeek(today);
  let weeklySpent = 0;

  data.expenses.forEach(function (expense) {
    if (expense.isRecurringGenerated) {
      return; // 確定支出由来の支出はスキップする
    }
    if (WEEKLY_BUDGET_EXCLUDED_CATEGORIES.indexOf(expense.categoryMain) !== -1) {
      return; // 金額が大きく不定期なカテゴリは、週予算には含めず残高から直接引くだけにする
    }
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

// 指定した年月に、指定したカテゴリ（メイン・内訳）の実績支出が
// 1件でも記録されているかどうかを調べる関数（生活費残高の計算で使う）
function hasActualExpenseInMonth(data, year, month, categoryMain, categorySub) {
  return data.expenses.some(function (expense) {
    if (expense.categoryMain !== categoryMain || expense.categorySub !== categorySub) {
      return false;
    }
    const expenseDate = parseDateString(expense.date);
    return expenseDate.getFullYear() === year && expenseDate.getMonth() === month;
  });
}

// 指定したカテゴリ（メイン・内訳）について、実績支出の中で一番最近の日付を探す関数
// 1件も無い場合は null を返す
function findLatestActualExpenseDate(data, categoryMain, categorySub) {
  let latestDate = null;

  data.expenses.forEach(function (expense) {
    if (expense.categoryMain !== categoryMain || expense.categorySub !== categorySub) {
      return;
    }
    const expenseDate = parseDateString(expense.date);
    if (latestDate === null || expenseDate > latestDate) {
      latestDate = expenseDate;
    }
  });

  return latestDate;
}



// 指定したカテゴリ（メイン・内訳）について、実績支出の直近3回・6回・9回・12回分の平均額を計算する関数
// 実績の件数が足りない回数分は、結果に含めない（例：実績が4件しか無ければ、3回分の平均だけ返す）
function calculateRecentAverages(data, categoryMain, categorySub) {
  const matchingExpenses = data.expenses.filter(function (expense) {
    return expense.categoryMain === categoryMain && expense.categorySub === categorySub;
  });

  // 日付が新しい順に並び替える（元の配列を壊さないようにslice()でコピーしてから）
  const sortedExpenses = matchingExpenses.slice().sort(function (a, b) {
    return parseDateString(b.date) - parseDateString(a.date);
  });

  const targetCounts = [3, 6, 9, 12];
  const averages = {};

  targetCounts.forEach(function (count) {
    if (sortedExpenses.length >= count) {
      const recentExpenses = sortedExpenses.slice(0, count);
      let total = 0;
      recentExpenses.forEach(function (expense) {
        total += expense.amount;
      });
      averages[count] = Math.round(total / count);
    }
  });

  return averages;
}

// 予想支出について、実績の平均から見直した方がよいものが1つでもあるかどうかを調べて、
// ホーム画面の小さなお知らせの表示/非表示を切り替える関数
function updateEstimatedReviewNotice(data) {
  const noticeElement = document.getElementById("estimated-review-notice");

  const hasSomethingToReview = data.estimatedExpenses.some(function (estimated) {
    const matchInfo = ESTIMATED_EXPENSE_CATEGORY_MAP[estimated.category];
    if (matchInfo === undefined) {
      return false;
    }

    const averages = calculateRecentAverages(data, matchInfo.categoryMain, matchInfo.categorySub);

    // 計算できた平均のうち、1つでも今の見込み金額と違っていれば「見直しの余地あり」とする
    return Object.keys(averages).some(function (count) {
      return averages[count] !== estimated.amount;
    });
  });

  noticeElement.style.display = hasSomethingToReview ? "block" : "none";
}

// 指定した年月が、支払いサイクル的に「請求が来るはずの月」かどうかを判定する関数
//
// 【判定の考え方】
// 一番最近実績が記録された月を基準（アンカー）にして、
// そこからサイクル月数（1か月・2か月・3か月）の倍数だけ進んだ月だけを「請求が来る月」とする。
// まだ一度も実績が無いカテゴリは、判断材料が無いため、常に「請求が来る月」として扱う（安全のため）
function isExpectedBillingMonth(data, matchInfo, checkYear, checkMonth, cycleMonths) {
  const latestDate = findLatestActualExpenseDate(data, matchInfo.categoryMain, matchInfo.categorySub);

  if (latestDate === null) {
    return true;
  }

  const anchorYear = latestDate.getFullYear();
  const anchorMonth = latestDate.getMonth();

  const monthsDiff = (checkYear - anchorYear) * 12 + (checkMonth - anchorMonth);

  return Math.abs(monthsDiff) % cycleMonths === 0;
}

// 「生活費残高」エリアの表示を更新する関数
//
// 【計算の考え方】
// 生活費残高 ＝ 現在の残高 － これから発生する確定支出 － これから発生する予想支出
//
// 予想支出は、今月～次回収入日までの各月について「その月にすでに実績が記録されていれば予約しない、
// まだなら見込み額を予約する」という考え方で計算する。収入サイクルが2か月おきなどでも
// 同じ仕組みでそのまま対応できる。
//
// 【なぜ「今週使える目安」の計算（updateWeeklySummaryDisplay）を使い回さないのか】
// あちらは今も現役で動いている機能なので、コードが多少重複しても、
// 既存の計算には一切触れないようにするため、あえて別の関数として独立させている。
function updateLivingCostBalanceDisplay(data) {
  const messageElement = document.getElementById("living-cost-balance-message");
  const detailsElement = document.getElementById("living-cost-balance-details");

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

  if (daysUntilIncome <= 0) {
    messageElement.textContent = "次回収入日を過ぎています。次回収入日を更新してください";
    detailsElement.style.display = "none";
    return;
  }

  // --- ここまで来たら、計算に必要な情報はすべて揃っている ---
  messageElement.textContent = "";
  detailsElement.style.display = "block";

  // 「次回収入日の前日」を先に求めておく
  const dayBeforeIncome = new Date(nextIncome);
  dayBeforeIncome.setDate(nextIncome.getDate() - 1);

  // --- 次回収入日までに発生する見込みの「確定支出」の合計 ---
  let upcomingRecurringTotal = 0;
  data.recurringExpenses.forEach(function (recurring) {
    let occurrenceDate = getNextRecurringDate(recurring, today);
    while (occurrenceDate <= dayBeforeIncome) {
      upcomingRecurringTotal += recurring.amount;
      occurrenceDate = getNextRecurringDate(recurring, occurrenceDate);
    }
  });

  // --- 次回収入日までに発生する見込みの「予想支出」の合計 ---
  // 「今月」から「次回収入日の前日を含む月」まで、1か月ずつ確認していく
  let upcomingEstimatedTotal = 0;
  data.estimatedExpenses.forEach(function (estimated) {
    const matchInfo = ESTIMATED_EXPENSE_CATEGORY_MAP[estimated.category];

    // 万が一、対応表に無いカテゴリだった場合は計算に含めない（安全のため）
    if (matchInfo === undefined) {
      return;
    }

    let checkYear = today.getFullYear();
    let checkMonth = today.getMonth();

    const endYear = dayBeforeIncome.getFullYear();
    const endMonth = dayBeforeIncome.getMonth();

    while (checkYear < endYear || (checkYear === endYear && checkMonth <= endMonth)) {
      // このカテゴリの支払いサイクル的に、この月に請求が来る予定かどうかを確認する
      // （例：水道が2か月ごとの場合、請求が来ない月はそもそも予約しない）
      const isBillingMonth = isExpectedBillingMonth(
        data, matchInfo, checkYear, checkMonth, estimated.cycleMonths
      );

      if (isBillingMonth) {
        const alreadyRecorded = hasActualExpenseInMonth(
          data, checkYear, checkMonth, matchInfo.categoryMain, matchInfo.categorySub
        );

        if (!alreadyRecorded) {
          upcomingEstimatedTotal += estimated.amount;
        }
      }

      checkMonth += 1;
      if (checkMonth > 11) {
        checkMonth = 0;
        checkYear += 1;
      }
    }
  });

  // --- 生活費残高を計算する ---
  const livingCostBalance = data.currentBalance - upcomingRecurringTotal - upcomingEstimatedTotal;

  // --- 画面に反映する ---
  document.getElementById("living-cost-balance-display").textContent = livingCostBalance.toLocaleString() + "円";
  document.getElementById("living-cost-recurring-display").textContent = upcomingRecurringTotal.toLocaleString() + "円";
  document.getElementById("living-cost-estimated-display").textContent = upcomingEstimatedTotal.toLocaleString() + "円";
  document.getElementById("living-cost-current-balance-display").textContent = data.currentBalance.toLocaleString() + "円";
  document.getElementById("living-cost-days-until-income-display").textContent = "あと" + daysUntilIncome + "日";
}

// ============================================================
// 【確定支出関連】
// ============================================================

// 現在編集中の確定支出のID番号。編集していないときは null
let editingRecurringId = null;

// 現在編集中の予想支出のID番号。編集していないときは null
let editingEstimatedId = null;

// 指定した確定支出のデータを、確定支出フォームに読み込んで「編集モード」にする関数
function startEditingRecurringExpense(recurringId) {
  const data = loadData();
  const recurring = data.recurringExpenses.find(function (r) {
    return r.id === recurringId;
  });

  // 万が一データが見つからなかった場合は、何もせず終了する
  if (recurring === undefined) {
    return;
  }

  editingRecurringId = recurringId;
  editingEstimatedId = null; // 予想支出側の編集モードは解除しておく

  // 先に画面を切り替えてから、フォームに値をセットする
  // （支出編集のときと同じく、iPhoneでの画面切り替え不具合を避けるため）
  showScreen("recurring");

  // フォームを「確定支出」用の見た目に切り替える
  document.getElementById("recurring-type-select").value = "fixed";
  applyRecurringTypeToForm("fixed");

  document.getElementById("recurring-name-input").value = recurring.name;
  document.getElementById("recurring-amount-input").value = recurring.amount;
  document.getElementById("recurring-day-input").value = recurring.dayOfMonth;
  document.getElementById("recurring-category").value = recurring.category;

  // ボタンの見た目を「編集モード」に切り替える
  document.getElementById("save-recurring-button").textContent = "確定支出を更新";
  document.getElementById("cancel-recurring-edit-button").style.display = "inline";
}


// 指定した予想支出のデータを、フォームに読み込んで「編集モード」にする関数
function startEditingEstimatedExpense(estimatedId) {
  const data = loadData();
  const estimated = data.estimatedExpenses.find(function (e) {
    return e.id === estimatedId;
  });

  if (estimated === undefined) {
    return;
  }

  editingEstimatedId = estimatedId;
  editingRecurringId = null; // 確定支出側の編集モードは解除しておく

  showScreen("recurring");

  // フォームを「予想支出」用の見た目に切り替える
  document.getElementById("recurring-type-select").value = "estimated";
  applyRecurringTypeToForm("estimated");

  document.getElementById("recurring-category").value = estimated.category;
  document.getElementById("recurring-amount-input").value = estimated.amount;
  document.getElementById("recurring-cycle-select").value = estimated.cycleMonths;

  document.getElementById("save-recurring-button").textContent = "予想支出を更新";
  document.getElementById("cancel-recurring-edit-button").style.display = "inline";
}


// 「種類」（確定支出／予想支出）に応じて、カテゴリの選択肢を作り直す関数
function updateRecurringCategoryOptions(type) {
  const selectElement = document.getElementById("recurring-category");
  selectElement.innerHTML = '<option value="">選択してください</option>';

  const categoryList = (type === "estimated")
    ? ESTIMATED_EXPENSE_CATEGORIES
    : RECURRING_EXPENSE_CATEGORIES;

  categoryList.forEach(function (categoryName) {
    const optionElement = document.createElement("option");
    optionElement.value = categoryName;
    optionElement.textContent = categoryName;
    selectElement.appendChild(optionElement);
  });
}


// 「種類」に応じて、名称・引き落とし日の入力欄を表示/非表示にする関数
// （予想支出には「名称」「引き落とし日」の概念が無いため）
function updateRecurringFormFieldsVisibility(type) {
  const nameRowElement = document.getElementById("recurring-name-row");
  const dayRowElement = document.getElementById("recurring-day-row");
  const cycleRowElement = document.getElementById("recurring-cycle-row");
  const amountLabelElement = document.getElementById("recurring-amount-label");

  if (type === "estimated") {
    nameRowElement.style.display = "none";
    dayRowElement.style.display = "none";
    cycleRowElement.style.display = "block";
    amountLabelElement.textContent = "1回あたりの見込み金額：";
  } else {
    nameRowElement.style.display = "block";
    dayRowElement.style.display = "block";
    cycleRowElement.style.display = "none";
    amountLabelElement.textContent = "金額：";
  }
}

// 「種類」の選択に合わせて、カテゴリ選択肢・入力欄の表示・保存ボタンの文言をまとめて切り替える関数
function applyRecurringTypeToForm(type) {
  updateRecurringCategoryOptions(type);
  updateRecurringFormFieldsVisibility(type);
  updateSaveButtonLabel(type);
}

// 「種類」と、今が新規登録中か編集中かに応じて、保存ボタンの文言を切り替える関数
// （「種類」のプルダウンをユーザーが直接変更したときに、ボタンの文言が古いままにならないようにするため）
function updateSaveButtonLabel(type) {
  const isEditing = (type === "estimated")
    ? (editingEstimatedId !== null)
    : (editingRecurringId !== null);

  const typeLabel = (type === "estimated") ? "予想支出" : "確定支出";
  const actionLabel = isEditing ? "更新" : "登録";

  document.getElementById("save-recurring-button").textContent = typeLabel + "を" + actionLabel;
}



// 編集モードを終了し、フォームを「新規登録（確定支出）」の初期状態に戻す関数
// ※確定支出・予想支出、両方の編集モードをまとめて解除する
function cancelEditingRecurringExpense() {
  editingRecurringId = null;
  editingEstimatedId = null;

  document.getElementById("recurring-type-select").value = "fixed";
  applyRecurringTypeToForm("fixed");

  document.getElementById("recurring-name-input").value = "";
  document.getElementById("recurring-amount-input").value = "";
  document.getElementById("recurring-day-input").value = "";
  document.getElementById("recurring-category").value = "";
  document.getElementById("recurring-cycle-select").value = "1";

  document.getElementById("save-recurring-button").textContent = "確定支出を登録";
  document.getElementById("cancel-recurring-edit-button").style.display = "none";
}

// 指定した年月の最終日を求める関数（例: 2026年2月 → 28）

// 指定した年月の最終日を求める関数（例: 2026年2月 → 28）
function getLastDayOfMonth(year, month) {
  // 「翌月の0日目」を指定すると、その月の最終日が求まるというDateの仕様を利用している
  return new Date(year, month + 1, 0).getDate();
}


// 確定支出の「指定した年月における引き落とし日」を求める関数
// dayOfMonthがその月に存在しない日（31日など）の場合は、その月の最終日に繰り下げる
function getDebitDateInMonth(recurring, year, month) {
  const lastDay = getLastDayOfMonth(year, month);
  const day = Math.min(recurring.dayOfMonth, lastDay);
  return new Date(year, month, day);
}


// 指定した日付（afterDate）より後で、直近の引き落とし日を求める関数
// 「今週の利用目安」の計算で、これから発生する確定支出を予測するために使う
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


// 登録されている確定支出をチェックし、引き落とし日を過ぎているものを
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
          categorySub: "",                  // 確定支出にサブカテゴリは無い
          memo: "（定期支出）" + recurring.name,
          isRecurringGenerated: true        // 確定支出から自動生成された支出であることの目印
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

// 登録済みの確定支出一覧を、カテゴリごとにグループ分けして画面に表示する関数
// 各カテゴリの中では、引き落とし日が早い順に並べる
function renderRecurringList(data) {
  const containerElement = document.getElementById("recurring-list");
  containerElement.innerHTML = "";

  // カテゴリは、登録フォームの選択肢と同じ順番で固定しておく
  const categoryOrder = RECURRING_EXPENSE_CATEGORIES;

  categoryOrder.forEach(function (categoryName) {
    // このカテゴリに属する確定支出だけを取り出す
    const itemsInCategory = data.recurringExpenses.filter(function (recurring) {
      return recurring.category === categoryName;
    });

    // このカテゴリに1件も登録が無ければ、見出しごと表示しない
    if (itemsInCategory.length === 0) {
      return;
    }

    // 引き落とし日が早い順に並び替える（元の配列を壊さないようにslice()でコピーしてから）
    const sortedItems = itemsInCategory.slice().sort(function (a, b) {
      return a.dayOfMonth - b.dayOfMonth;
    });

    // カテゴリの見出しを追加する
    const headingElement = document.createElement("h4");
    headingElement.textContent = categoryName;
    containerElement.appendChild(headingElement);

    // このカテゴリの一覧（ul）を作る
    const listElement = document.createElement("ul");

    sortedItems.forEach(function (recurring) {
      const itemElement = document.createElement("li");

      const textElement = document.createElement("span");
      textElement.textContent = recurring.name + "／毎月" + recurring.dayOfMonth + "日／" +
        recurring.amount.toLocaleString() + "円";
      itemElement.appendChild(textElement);

      const editButton = document.createElement("button");
      editButton.textContent = "編集";
      editButton.className = "recurring-edit-button";
      editButton.addEventListener("click", function () {
        startEditingRecurringExpense(recurring.id);
      });
      itemElement.appendChild(editButton);

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "削除";
      deleteButton.className = "recurring-delete-button";
      deleteButton.addEventListener("click", function () {
        deleteRecurringExpense(recurring.id);
      });
      itemElement.appendChild(deleteButton);

      listElement.appendChild(itemElement);
    });

    containerElement.appendChild(listElement);
  });
}

// 登録済みの予想支出一覧を画面に表示する関数
function renderEstimatedList(data) {
  const listElement = document.getElementById("estimated-list");
  listElement.innerHTML = "";

  data.estimatedExpenses.forEach(function (estimated) {
    const itemElement = document.createElement("li");

    // メインの情報（カテゴリ・サイクル・金額）と、平均額の情報をまとめて入れる箱
    const contentElement = document.createElement("div");
    contentElement.className = "estimated-item-content";

    const mainLineElement = document.createElement("div");
    const cycleLabel = ESTIMATED_EXPENSE_CYCLE_LABELS[estimated.cycleMonths];
    mainLineElement.textContent = estimated.category + "／" + cycleLabel + "／" +estimated.amount.toLocaleString() + "円（見込み）";
    contentElement.appendChild(mainLineElement);

    // 実績の平均額を計算し、データが十分にある回数分だけ、小さめの文字で表示する
    const matchInfo = ESTIMATED_EXPENSE_CATEGORY_MAP[estimated.category];
    if (matchInfo !== undefined) {
      const averages = calculateRecentAverages(data, matchInfo.categoryMain, matchInfo.categorySub);
      const averageTexts = [];

      [3, 6, 9, 12].forEach(function (count) {
        if (averages[count] !== undefined) {
          averageTexts.push("直近" + count + "回平均：" + averages[count].toLocaleString() + "円");
        }
      });

      if (averageTexts.length > 0) {
        const averageLineElement = document.createElement("div");
        averageLineElement.className = "estimated-average-line";
        averageLineElement.textContent = averageTexts.join("／");
        contentElement.appendChild(averageLineElement);
      }
    }

    const editButton = document.createElement("button");
    editButton.textContent = "編集";
    editButton.className = "recurring-edit-button";
    editButton.addEventListener("click", function () {
      startEditingEstimatedExpense(estimated.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";
    deleteButton.className = "recurring-delete-button";
    deleteButton.addEventListener("click", function () {
      deleteEstimatedExpense(estimated.id);
    });

    itemElement.appendChild(contentElement);
    itemElement.appendChild(editButton);
    itemElement.appendChild(deleteButton);
    listElement.appendChild(itemElement);
  });
}

// 「確定支出」フォームの内容を保存する関数
function saveFixedRecurringExpenseForm() {
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

  // 入力チェック⑤：カテゴリが選ばれていない場合は止める
  if (categoryValue === "") {
    alert("カテゴリを選択してください");
    return;
  }

  const latestData = loadData();

  // editingRecurringIdがnull → 新規登録モード／それ以外 → 更新モード
  if (editingRecurringId === null) {

    // ---------------- 新規登録モード ----------------
    const newRecurring = {
      id: latestData.nextRecurringExpenseId,
      name: nameValue,
      amount: amountValue,
      dayOfMonth: dayValue,
      category: categoryValue,
      lastGeneratedYearMonth: null      // まだ一度も支出として記録していない
    };

    latestData.nextRecurringExpenseId += 1;
    latestData.recurringExpenses.push(newRecurring);

    saveData(latestData);
    renderRecurringList(latestData);
    updateLivingCostBalanceDisplay(latestData);
    updateEstimatedReviewNotice(latestData);

    alert("確定支出を登録しました");
    cancelEditingRecurringExpense();

  } else {

    // ---------------- 更新（編集）モード ----------------
    const targetIndex = latestData.recurringExpenses.findIndex(function (r) {
      return r.id === editingRecurringId;
    });

    if (targetIndex === -1) {
      alert("編集対象の確定支出が見つかりませんでした");
      cancelEditingRecurringExpense();
      return;
    }

    const oldRecurring = latestData.recurringExpenses[targetIndex];

    // 【重要】過去に自動生成された支出（data.expenses側）や残高は、ここでは一切変更しない。
    // lastGeneratedYearMonthもそのまま引き継ぐことで、
    // 「もう記録済みの月」が編集によって二重に記録されないようにしている。
    latestData.recurringExpenses[targetIndex] = {
      id: editingRecurringId,
      name: nameValue,
      amount: amountValue,
      dayOfMonth: dayValue,
      category: categoryValue,
      lastGeneratedYearMonth: oldRecurring.lastGeneratedYearMonth
    };

    saveData(latestData);
    renderRecurringList(latestData);
    updateLivingCostBalanceDisplay(latestData);
    updateEstimatedReviewNotice(latestData);

    alert("確定支出を更新しました");
    cancelEditingRecurringExpense();
  }
}

// 「予想支出」フォームの内容を保存する関数
function saveEstimatedExpenseForm() {
  const amountInput = document.getElementById("recurring-amount-input");
  const categoryInput = document.getElementById("recurring-category");
  const cycleInput = document.getElementById("recurring-cycle-select");

  const amountValue = Number(amountInput.value);
  const categoryValue = categoryInput.value;
  const cycleValue = Number(cycleInput.value);

  // 入力チェック①：金額が0円以下、または未入力（NaN）の場合は止める
  if (amountInput.value === "" || Number.isNaN(amountValue) || amountValue <= 0) {
    alert("金額は1円以上の数字を入力してください");
    return;
  }

  // 入力チェック②：金額が整数でない場合は止める
  if (!Number.isInteger(amountValue)) {
    alert("金額は整数で入力してください");
    return;
  }

  // 入力チェック③：カテゴリが選ばれていない場合は止める
  if (categoryValue === "") {
    alert("カテゴリを選択してください");
    return;
  }

  const latestData = loadData();

  // editingEstimatedIdがnull → 新規登録モード／それ以外 → 更新モード
  if (editingEstimatedId === null) {

    // ---------------- 新規登録モード ----------------
    const newEstimated = {
      id: latestData.nextEstimatedExpenseId,
      category: categoryValue,
      amount: amountValue,
      cycleMonths: cycleValue
    };

    latestData.nextEstimatedExpenseId += 1;
    latestData.estimatedExpenses.push(newEstimated);

    saveData(latestData);
    renderEstimatedList(latestData);
    updateLivingCostBalanceDisplay(latestData);
    updateEstimatedReviewNotice(latestData);

    alert("予想支出を登録しました");
    cancelEditingRecurringExpense();

  } else {

    // ---------------- 更新（編集）モード ----------------
    const targetIndex = latestData.estimatedExpenses.findIndex(function (e) {
      return e.id === editingEstimatedId;
    });

    if (targetIndex === -1) {
      alert("編集対象の予想支出が見つかりませんでした");
      cancelEditingRecurringExpense();
      return;
    }

    latestData.estimatedExpenses[targetIndex] = {
      id: editingEstimatedId,
      category: categoryValue,
      amount: amountValue,
      cycleMonths: cycleValue
    };

    saveData(latestData);
    renderEstimatedList(latestData);
    updateLivingCostBalanceDisplay(latestData);
    updateEstimatedReviewNotice(latestData);

    alert("予想支出を更新しました");
    cancelEditingRecurringExpense();
  }
}

// 指定したIDの予想支出を削除する関数
function deleteEstimatedExpense(estimatedId) {
  const confirmed = confirm("この予想支出の設定を削除しますか？");
  if (!confirmed) {
    return;
  }

  const latestData = loadData();
  const targetIndex = latestData.estimatedExpenses.findIndex(function (e) {
    return e.id === estimatedId;
  });

  if (targetIndex === -1) {
    return;
  }

  latestData.estimatedExpenses.splice(targetIndex, 1);
  saveData(latestData);

  renderEstimatedList(latestData);
  updateLivingCostBalanceDisplay(latestData);
  updateEstimatedReviewNotice(latestData);
}

// 指定したIDの確定支出「設定」を削除する関数
// 過去に自動生成された支出（data.expenses側のデータ）はここでは一切変更しない
function deleteRecurringExpense(recurringId) {
  const confirmed = confirm("この確定支出の設定を削除しますか？（すでに記録された支出履歴は残ります）");
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
  updateLivingCostBalanceDisplay(latestData);
  updateEstimatedReviewNotice(latestData);
}


// ============================================================
// ページの読み込みが完了したタイミングで、この中身が実行される
// ============================================================
window.onload = function () {

  // --- STEP1で作った動作確認メッセージ ---
  document.getElementById("status-message").textContent = "✅ 正常に動いています！";

  // --- 保存されているデータを読み込んで、画面に反映する ---
  const data = loadData();

  // --- 確定支出の自動反映（引き落とし日を過ぎているものを、通常の支出として記録する） ---
  const generatedExpense = processRecurringExpenses(data);
  if (generatedExpense) {
    saveData(data); // 新しく支出が生成された場合のみ、保存し直す
  }

  updateBalanceDisplay(data);
  updateIncomeDateDisplay(data);
  updateWeeklySummaryDisplay(data);
  updateLivingCostBalanceDisplay(data);
  updateEstimatedReviewNotice(data);
  renderBalanceAdjustmentList(data); // 残高修正履歴を表示する

  // --- 支出フォームの初期化 ---
  populateMainCategoryOptions("expense-category-main");       // カテゴリ第一階層の選択肢を作る
  updateSubCategoryOptions("", "expense-category-sub");       // カテゴリ第二階層を「選択しない」だけの状態にする
  document.getElementById("expense-date-input").value = getTodayDateString(); // 日付の初期値を今日にする

  // --- 収入フォームの初期化 ---
  document.getElementById("income-entry-date-input").value = getTodayDateString(); // 日付の初期値を今日にする

  // --- 確定支出・予想支出フォームの初期化 ---
  applyRecurringTypeToForm("fixed"); // 最初は「確定支出」用の見た目にしておく
  renderRecurringList(data);
  renderEstimatedList(data);

  // 「種類」が切り替えられたら、フォームの見た目を切り替える
  const recurringTypeSelect = document.getElementById("recurring-type-select");
  recurringTypeSelect.addEventListener("change", function () {
    applyRecurringTypeToForm(recurringTypeSelect.value);
  });

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

  // 「編集」ボタン：日付詳細パネルの編集ボタンをまとめて表示/非表示する
  document.getElementById("day-detail-edit-toggle-button").addEventListener("click", function () {
    dayDetailEditMode = !dayDetailEditMode;
    showDayDetail(currentDayDetailDate, loadData());
  });

  // 「削除」ボタン：日付詳細パネルの削除ボタンをまとめて表示/非表示する
  document.getElementById("day-detail-delete-toggle-button").addEventListener("click", function () {
    dayDetailDeleteMode = !dayDetailDeleteMode;
    showDayDetail(currentDayDetailDate, loadData());
  });

  // 「✕」ボタン：ポップアップを閉じる
  document.getElementById("day-detail-close-button").addEventListener("click", function () {
    closeDayDetail();
  });

  // 背景（バックドロップ）をタップしたときも、ポップアップを閉じる
  document.getElementById("day-detail-backdrop").addEventListener("click", function () {
    closeDayDetail();
  });

  // カテゴリの第一階層が変更されたら、第二階層の選択肢を作り直す（支出フォーム）
  const categoryMainSelect = document.getElementById("expense-category-main");
  categoryMainSelect.addEventListener("change", function () {
    updateSubCategoryOptions(categoryMainSelect.value, "expense-category-sub");
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
    updateLivingCostBalanceDisplay(latestData);
    updateEstimatedReviewNotice(latestData);
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
    updateLivingCostBalanceDisplay(latestData);
    updateEstimatedReviewNotice(latestData);

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
        memo: memoValue,               // 未入力の場合は ""（空文字）が入る
        isRecurringGenerated: false    // 手入力の支出なのでfalse
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
      updateLivingCostBalanceDisplay(latestData);
      updateEstimatedReviewNotice(latestData);
      
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
        memo: memoValue,
        isRecurringGenerated: false // 履歴画面から編集した支出は、手入力扱いにする
      };

      saveData(latestData);

      updateBalanceDisplay(latestData);
      renderCalendar(latestData);
      updateWeeklySummaryDisplay(latestData);
      updateLivingCostBalanceDisplay(latestData);
      updateEstimatedReviewNotice(latestData);
      
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
      updateLivingCostBalanceDisplay(latestData);
      updateEstimatedReviewNotice(latestData);
      
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
      updateLivingCostBalanceDisplay(latestData);
      updateEstimatedReviewNotice(latestData);

      alert("収入を更新しました");
      cancelEditingIncome();
    }
  });

  // --- 「キャンセル」ボタンが押されたときの処理を登録する（収入の編集モードの中断） ---
  const cancelIncomeEditButton = document.getElementById("cancel-income-edit-button");
  cancelIncomeEditButton.addEventListener("click", function () {
    cancelEditingIncome();
  });

  // --- 「確定支出を登録」「予想支出を登録」ボタンが押されたときの処理を登録する ---
  // ボタンは1つだが、「種類」の選択によって保存先を振り分ける
  const saveRecurringButton = document.getElementById("save-recurring-button");

  saveRecurringButton.addEventListener("click", function () {
    const typeValue = document.getElementById("recurring-type-select").value;

    if (typeValue === "estimated") {
      saveEstimatedExpenseForm();
    } else {
      saveFixedRecurringExpenseForm();
    }
  });

    // --- 「キャンセル」ボタンが押されたときの処理を登録する（確定支出の編集モードの中断） ---
  const cancelRecurringEditButton = document.getElementById("cancel-recurring-edit-button");
  cancelRecurringEditButton.addEventListener("click", function () {
    cancelEditingRecurringExpense();
  });

  // --- 「初期設定・収入日当日画面」の「登録」ボタンが押されたときの処理を登録する ---
  const setupSaveButton = document.getElementById("setup-save-button");

  setupSaveButton.addEventListener("click", function () {
    const balanceInput = document.getElementById("setup-balance-input");
    const incomeDateInput = document.getElementById("setup-income-date-input");

    const balanceInputValue = balanceInput.value;
    const incomeDateValue = incomeDateInput.value;

    // 入力チェック①：残高が未入力の場合は止める
    if (balanceInputValue === "") {
      alert("現在の残高を入力してください");
      return;
    }

    const balanceAmount = Number(balanceInputValue);

    // 入力チェック②：数値に変換できない場合は止める
    if (Number.isNaN(balanceAmount)) {
      alert("正しい金額を入力してください");
      return;
    }

    // 入力チェック③：次回収入日が未入力の場合は止める
    if (incomeDateValue === "") {
      alert("次回収入日を選択してください");
      return;
    }

    // 最新のデータを読み込み直してから更新する
    const latestData = loadData();

    // latestData.currentBalanceがnull → 初めての登録／それ以外 → 収入日当日の修正
    if (latestData.currentBalance === null) {

      // ---------------- 初めての登録（履歴には残さない） ----------------
      latestData.initialBalance = balanceAmount;
      latestData.currentBalance = balanceAmount;

    } else {

      // ---------------- 収入日当日の修正（修正履歴に記録を残す） ----------------
      const oldBalance = latestData.currentBalance;

      const newAdjustment = {
        id: latestData.nextBalanceAdjustmentId,
        date: getTodayDateString(),
        oldBalance: oldBalance,
        newBalance: balanceAmount
      };
      latestData.nextBalanceAdjustmentId += 1;
      latestData.balanceAdjustments.push(newAdjustment);

      latestData.currentBalance = balanceAmount;
    }

    // 次回収入日は、初めての登録・修正どちらの場合も上書きする
    latestData.nextIncomeDate = incomeDateValue;

    saveData(latestData);

    // 画面の表示を更新する
    updateBalanceDisplay(latestData);
    updateIncomeDateDisplay(latestData);
    updateWeeklySummaryDisplay(latestData);
    updateLivingCostBalanceDisplay(latestData);
    updateEstimatedReviewNotice(latestData);
    renderBalanceAdjustmentList(latestData);

    alert("登録しました");

    // 登録が終わったら、ホーム画面に切り替える
    showScreen("home");
  });

  // --- 画面切り替えボタンの処理を登録する ---
  // data-screen属性を持つボタンはすべて対象（☰メニューの項目＋ホーム画面のショートカットボタン）
  document.querySelectorAll("[data-screen]").forEach(function (button) {
    button.addEventListener("click", function () {
      showScreen(button.dataset.screen);
    });
  });

  // --- 最初に表示する画面を決める ---
  // 「残高も次回収入日も未登録（初めて使うとき）」または
  // 「次回収入日が今日以前（収入日が来た・過ぎた）」のときは、
  // ホーム画面の代わりに「初期設定・収入日当日画面」を最初に表示する
  const isFirstTime = (data.currentBalance === null && data.nextIncomeDate === null);

  let isIncomeDayOrPast = false;
  if (data.nextIncomeDate !== null) {
    const todayForSetupCheck = parseDateString(getTodayDateString());
    const nextIncomeForSetupCheck = parseDateString(data.nextIncomeDate);
    isIncomeDayOrPast = (nextIncomeForSetupCheck <= todayForSetupCheck);
  }

  if (isFirstTime || isIncomeDayOrPast) {
    // 収入日当日・経過の場合は、今の残高・次回収入日を入力欄にあらかじめ表示しておく
    // （初めて使うときは、まだ値が無いので空欄のままになる）
    if (data.currentBalance !== null) {
      document.getElementById("setup-balance-input").value = data.currentBalance;
    }
    if (data.nextIncomeDate !== null) {
      document.getElementById("setup-income-date-input").value = data.nextIncomeDate;
    }
    showScreen("setup");
  } else {
    showScreen("home");
  }

};