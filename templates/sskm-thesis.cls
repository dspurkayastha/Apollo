%% sskm-thesis.cls
%% LaTeX Class File for MD/MS/DM/MCh/MDS Thesis
%% Institute of Post Graduate Medical Education & Research (IPGMER)
%% and SSKM Hospital, Kolkata
%%
%% Version 3.0 — February 2026
%% For West Bengal University of Health Sciences (WBUHS)
%%
%% TOPIC-AGNOSTIC TEMPLATE
%% Harmonised API with ssuhs-thesis.cls for cross-institution compatibility.
%%

\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{sskm-thesis}[2026/02/11 IPGMER MD/MS Thesis Class v3.0]

%% Base class: report
\LoadClass[12pt,a4paper,oneside]{report}

%% ============================================================
%% REQUIRED PACKAGES
%% ============================================================

% Page geometry - WBUHS specifications
% Left: 1.5 inches (binding edge), Others: 1 inch
\RequirePackage[
    a4paper,
    left=1.5in,
    right=1in,
    top=1in,
    bottom=1in,
    headheight=14pt,
    includehead,
    includefoot
]{geometry}

% Font packages - Times New Roman
\RequirePackage{mathptmx}
\RequirePackage[T1]{fontenc}
\RequirePackage[utf8]{inputenc}

% Line spacing - 1.5 as per WBUHS
\RequirePackage{setspace}
\onehalfspacing

% TOC formatting - load before subfig to avoid conflict
\RequirePackage[titles]{tocloft}

% Graphics and figures
\RequirePackage{graphicx}
\RequirePackage{float}
\RequirePackage{subfig}

% Tables
\RequirePackage{booktabs}
\RequirePackage{longtable}
\RequirePackage{array}
\RequirePackage{multirow}
\RequirePackage{tabularx}

% Citations and bibliography - Vancouver style
\RequirePackage[numbers,square,sort&compress]{natbib}

% Hyperlinks (load before other packages that modify references)
\RequirePackage[
    colorlinks=false,
    pdfborder={0 0 0},
    bookmarks=true,
    bookmarksnumbered=true,
    breaklinks=true,
    hypertexnames=false
]{hyperref}

% Caption formatting
\RequirePackage{caption}
\captionsetup{
    font=small,
    labelfont=bf,
    justification=justified,
    singlelinecheck=false
}

% Headers and footers
\RequirePackage{fancyhdr}

% Title formatting
\RequirePackage{titlesec}

% No hyphenation as per WBUHS
\RequirePackage[none]{hyphenat}
\sloppy

% Page layout utilities
\RequirePackage{emptypage}
\RequirePackage{afterpage}

% List formatting
\RequirePackage{enumitem}

% Math packages (for medical statistics)
\RequirePackage{amsmath}
\RequirePackage{amssymb}

% British English spelling
\RequirePackage[UKenglish]{babel}

% Date formatting
\RequirePackage[UKenglish]{datetime}

% PDF inclusion for annexures
\RequirePackage{pdfpages}

% Color support
\RequirePackage{xcolor}

% Conditional commands
\RequirePackage{etoolbox}

% Nomenclature/Abbreviations
\RequirePackage{nomencl}
\makenomenclature

% Landscape pages for master chart
\RequirePackage{pdflscape}

% Decorative and layout packages
\RequirePackage{lettrine}
\RequirePackage{threeparttable}
\RequirePackage{ragged2e}
\justifying
\RequirePackage{needspace}

% Watermark support
\RequirePackage{draftwatermark}
\RequirePackage{xfp}
\SetWatermarkText{}
\SetWatermarkScale{1}
\SetWatermarkAngle{45}
\SetWatermarkColor[gray]{0.85}

%% ============================================================
%% WIDOW/ORPHAN CONTROL
%% ============================================================

\widowpenalty=10000
\clubpenalty=10000
\displaywidowpenalty=10000

%% ============================================================
%% THESIS METADATA - Using expandable storage
%% ============================================================

%% Storage commands - these store the actual values
\newcommand{\thesistitletext}{}
\newcommand{\thesiskeywordstext}{}
\newcommand{\candidatenametext}{}
\newcommand{\candidatedesignationtext}{Post Graduate Trainee}
\newcommand{\registrationnotext}{}
\newcommand{\academicsessiontext}{}
\newcommand{\studyperiodtext}{}
\newcommand{\supervisornametext}{}
\newcommand{\supervisordesignationtext}{}
\newcommand{\cosupervisornametext}{}
\newcommand{\cosupervisordesignationtext}{}
\newcommand{\cosupervisordepartmenttext}{}
\newcommand{\hodnametext}{}
\newcommand{\hoddesignationtext}{Professor and Head of Department}
\newcommand{\institutionheadnametext}{}
\newcommand{\institutionheaddesignationtext}{Director}
\newcommand{\departmentnametext}{}
\newcommand{\institutenametext}{Institute of Post Graduate Medical Education and Research \& SSKM Hospital}
\newcommand{\institutenameshorttext}{IPGME\&R and SSKM Hospital}
\newcommand{\institutelocationtext}{Kolkata}
\newcommand{\universitynametext}{West Bengal University of Health Sciences}
\newcommand{\universitylocationtext}{Kolkata, West Bengal}
\newcommand{\degreenametext}{}
\newcommand{\degreebranchtext}{}
\newcommand{\submissionmonthtext}{}
\newcommand{\submissionyeartext}{}
\newcommand{\universitylogopath}{}
\newcommand{\institutelogopath}{}

%% User-facing commands to set values
\newcommand{\thesistitle}[1]{\renewcommand{\thesistitletext}{#1}}
\newcommand{\thesiskeywords}[1]{\renewcommand{\thesiskeywordstext}{#1}}
\newcommand{\candidatename}[1]{\renewcommand{\candidatenametext}{#1}}
\newcommand{\candidatedesignation}[1]{\renewcommand{\candidatedesignationtext}{#1}}
\newcommand{\registrationno}[1]{\renewcommand{\registrationnotext}{#1}}
\newcommand{\academicsession}[1]{\renewcommand{\academicsessiontext}{#1}\renewcommand{\studyperiodtext}{#1}}
\newcommand{\studyperiod}[1]{\renewcommand{\studyperiodtext}{#1}}
\newcommand{\supervisorname}[1]{\renewcommand{\supervisornametext}{#1}}
\newcommand{\supervisordesignation}[1]{\renewcommand{\supervisordesignationtext}{#1}}
\newcommand{\cosupervisorname}[1]{\renewcommand{\cosupervisornametext}{#1}}
\newcommand{\cosupervisordesignation}[1]{\renewcommand{\cosupervisordesignationtext}{#1}}
\newcommand{\cosupervisordepartment}[1]{\renewcommand{\cosupervisordepartmenttext}{#1}}
\newcommand{\hodname}[1]{\renewcommand{\hodnametext}{#1}}
\newcommand{\hoddesignation}[1]{\renewcommand{\hoddesignationtext}{#1}}
\newcommand{\institutionheadname}[1]{\renewcommand{\institutionheadnametext}{#1}}
\newcommand{\institutionheaddesignation}[1]{\renewcommand{\institutionheaddesignationtext}{#1}}
\newcommand{\departmentname}[1]{\renewcommand{\departmentnametext}{#1}}
\newcommand{\institutename}[1]{\renewcommand{\institutenametext}{#1}}
\newcommand{\institutenameshort}[1]{\renewcommand{\institutenameshorttext}{#1}}
\newcommand{\institutelocation}[1]{\renewcommand{\institutelocationtext}{#1}}
\newcommand{\universityname}[1]{\renewcommand{\universitynametext}{#1}}
\newcommand{\universitylocation}[1]{\renewcommand{\universitylocationtext}{#1}}
\newcommand{\degreename}[1]{\renewcommand{\degreenametext}{#1}}
\newcommand{\degreebranch}[1]{\renewcommand{\degreebranchtext}{#1}}
\newcommand{\submissionmonth}[1]{\renewcommand{\submissionmonthtext}{#1}}
\newcommand{\submissionyear}[1]{\renewcommand{\submissionyeartext}{#1}}
\newcommand{\universitylogo}[1]{\renewcommand{\universitylogopath}{#1}}
\newcommand{\institutelogo}[1]{\renewcommand{\institutelogopath}{#1}}

%% Aliases for guide/supervisor terminology
\let\guidename\supervisorname
\let\guidedesignation\supervisordesignation

%% Aliases for co-guide/co-supervisor terminology
\let\coguidename\cosupervisorname
\let\coguidedesignation\cosupervisordesignation
\let\coguidedepartment\cosupervisordepartment

%% Aliases for institution head (SSKM uses "Director" as primary)
\let\directorname\institutionheadname
\let\directordesignation\institutionheaddesignation
\let\principalname\institutionheadname
\let\principaldesignation\institutionheaddesignation

%% Aliases for college/institute terminology
\let\collegename\institutename
\let\collegelocation\institutelocation

%% ============================================================
%% PAGE STYLE CONFIGURATION
%% ============================================================

%% Storage for current chapter title (used in running headers)
\newcommand{\currentchaptertitle}{}

%% SSKM page style: bottom-CENTRE page numbers, no left footer
\fancypagestyle{plain}{%
    \fancyhf{}
    \fancyfoot[C]{\small Page \thepage}
    \renewcommand{\headrulewidth}{0pt}
    \renewcommand{\footrulewidth}{0.3pt}
}

\fancypagestyle{mainmatter}{%
    \fancyhf{}
    \fancyhead[R]{\small\itshape\currentchaptertitle}
    \fancyfoot[C]{\small Page \thepage}
    \renewcommand{\headrulewidth}{0.3pt}
    \renewcommand{\footrulewidth}{0.3pt}
}

\fancypagestyle{frontmatter}{%
    \fancyhf{}
    \renewcommand{\headrulewidth}{0pt}
    \renewcommand{\footrulewidth}{0pt}
}

\fancypagestyle{bibliography}{%
    \fancyhf{}
    \fancyhead[R]{\small\itshape References}
    \fancyfoot[C]{\small Page \thepage}
    \renewcommand{\headrulewidth}{0.3pt}
    \renewcommand{\footrulewidth}{0.3pt}
}

\fancypagestyle{annexure}{%
    \fancyhf{}
    \fancyhead[R]{\small\itshape Annexures}
    \fancyfoot[C]{\small Page \thepage}
    \renewcommand{\headrulewidth}{0.3pt}
    \renewcommand{\footrulewidth}{0.3pt}
}

%% ============================================================
%% CHAPTER AND SECTION FORMATTING
%% ============================================================

\titleformat{\chapter}[display]
    {\normalfont\Large\bfseries\centering}
    {\MakeUppercase{\chaptertitlename}\ \thechapter}
    {0pt}
    {\Large\MakeUppercase}
\titlespacing*{\chapter}{0pt}{-20pt}{20pt}

%% Hook to capture chapter title for running headers
\let\oldchapter\chapter
\renewcommand{\chapter}{\@ifstar{\starchapter}{\@dblarg\nostarchapter}}
\newcommand{\starchapter}[1]{%
    \oldchapter*{#1}%
    \gdef\currentchaptertitle{#1}%
}
\def\nostarchapter[#1]#2{%
    \oldchapter[#1]{#2}%
    \gdef\currentchaptertitle{#2}%
}

\titleformat{\section}
    {\normalfont\large\bfseries}
    {\thesection}
    {1em}
    {}
\titlespacing*{\section}{0pt}{12pt}{6pt}

\titleformat{\subsection}
    {\normalfont\normalsize\bfseries}
    {\thesubsection}
    {1em}
    {}
\titlespacing*{\subsection}{0pt}{10pt}{5pt}

\titleformat{\subsubsection}
    {\normalfont\normalsize\bfseries\itshape}
    {\thesubsubsection}
    {1em}
    {}
\titlespacing*{\subsubsection}{0pt}{8pt}{4pt}

%% ============================================================
%% TABLE OF CONTENTS FORMATTING
%% ============================================================

\renewcommand{\contentsname}{TABLE OF CONTENTS}
\renewcommand{\listfigurename}{LIST OF FIGURES}
\renewcommand{\listtablename}{LIST OF TABLES}
\renewcommand{\bibname}{REFERENCES}
\renewcommand{\nomname}{LIST OF ABBREVIATIONS}

\renewcommand{\cftchapfont}{\normalfont\bfseries}
\renewcommand{\cftchappagefont}{\normalfont\bfseries}
\renewcommand{\cftsecfont}{\normalfont}
\renewcommand{\cftsecpagefont}{\normalfont}

\renewcommand{\cftchapleader}{\cftdotfill{\cftdotsep}}
\renewcommand{\cftsecleader}{\cftdotfill{\cftdotsep}}

%% ============================================================
%% TITLE PAGE
%% ============================================================

\newcommand{\maketitlepage}{%
    \thispagestyle{empty}
    \begin{singlespace}
    \begin{center}
        \vspace*{0.3cm}

        % University logo (if defined and non-empty)
        \ifx\universitylogopath\empty\else
            \includegraphics[width=4.5cm]{\universitylogopath}\\[0.4cm]
        \fi

        {\Large\bfseries\MakeUppercase{\thesistitletext}}

        \vspace{0.8cm}

        {\large DISSERTATION SUBMITTED FOR THE DEGREE OF}

        \vspace{0.4cm}

        {\large\bfseries \degreenametext\ (\degreebranchtext)}

        \vspace{0.4cm}

        {\large TO}

        \vspace{0.4cm}

        {\large\bfseries \universitynametext}\\
        {\large \universitylocationtext}

        \vspace{0.8cm}

        % Candidate and Guide info in tabular layout
        \begin{tabular}{@{}p{0.45\textwidth}p{0.45\textwidth}@{}}
            \raggedright
            {\normalsize\bfseries Candidate:}\\[0.2cm]
            {\large\bfseries \candidatenametext}\\
            {\normalsize \candidatedesignationtext}\\
            {\normalsize Reg.\ No.: \registrationnotext}\\
            {\normalsize Session: \academicsessiontext}
            &
            \raggedleft
            {\normalsize\bfseries Guide:}\\[0.2cm]
            {\large\bfseries \supervisornametext}\\
            {\normalsize \supervisordesignationtext}\\
            {\normalsize \departmentnametext}\\
            {\normalsize \institutenameshorttext}
        \end{tabular}

        \vfill

        {\large \departmentnametext}\\[0.3cm]
        {\large\bfseries \institutenametext}\\
        {\large \institutelocationtext}

        \vspace{0.5cm}

        {\large \submissionmonthtext\ \submissionyeartext}

    \end{center}
    \end{singlespace}
    \clearpage
}

%% ============================================================
%% CERTIFICATE FROM THE GUIDE
%% ============================================================

\newcommand{\makeguidecertificate}{%
    \clearpage
    \thispagestyle{empty}
    \begin{singlespace}
    \begin{center}
        {\Large\bfseries CERTIFICATE FROM THE GUIDE}\\[1cm]
    \end{center}

    \noindent This is to certify that the dissertation entitled \textbf{``\thesistitletext''} is the bonafide work of \textbf{\candidatenametext}, \candidatedesignationtext, \departmentnametext, \institutenametext, \institutelocationtext.

    \vspace{0.5cm}

    \noindent This work has been carried out under my direct supervision and guidance in partial fulfilment of the requirements for the award of the degree of \textbf{\degreenametext\ (\degreebranchtext)} from \textbf{\universitynametext}, Kolkata.

    \vspace{0.5cm}

    \noindent I further certify that:
    \begin{enumerate}[label=\arabic*.,itemsep=2pt,parsep=2pt]
        \item This dissertation or any part thereof has not been previously submitted to any university or institution for the award of any degree, diploma, or other similar title.
        \item The candidate has fulfilled all the requirements as per the university regulations.
        \item The work embodied in this dissertation is original.
    \end{enumerate}

    \vfill

    \noindent Place: \institutelocationtext \hfill \\[0.3cm]
    \noindent Date: \underline{\hspace{3cm}}

    \vspace{1.5cm}

    \begin{flushright}
        \underline{\hspace{6cm}}\\[0.2cm]
        \textbf{\supervisornametext}\\
        \supervisordesignationtext\\
        \departmentnametext\\
        \institutenameshorttext\\
        \institutelocationtext
    \end{flushright}
    \end{singlespace}
}

%% Alias
\let\makesupervisorcertificate\makeguidecertificate

%% ============================================================
%% CERTIFICATE FROM THE CO-GUIDE (Optional)
%% ============================================================

\newcommand{\makecoguidecertificate}{%
    \clearpage
    \thispagestyle{empty}
    \begin{singlespace}
    \begin{center}
        {\Large\bfseries CERTIFICATE FROM THE CO-GUIDE}\\[1cm]
    \end{center}

    \noindent This is to certify that the dissertation entitled \textbf{``\thesistitletext''} is the bonafide work of \textbf{\candidatenametext}, \candidatedesignationtext, \departmentnametext, \institutenametext, \institutelocationtext.

    \vspace{0.5cm}

    \noindent This work has been carried out under the supervision and guidance of the Guide, \textbf{\supervisornametext}, \supervisordesignationtext, \departmentnametext, in partial fulfilment of the requirements for the award of the degree of \textbf{\degreenametext\ (\degreebranchtext)} from \textbf{\universitynametext}, Kolkata.

    \vspace{0.5cm}

    \noindent I have co-supervised this work and certify that the candidate has fulfilled all the requirements as per the university regulations.

    \vfill

    \noindent Place: \institutelocationtext \hfill \\[0.3cm]
    \noindent Date: \underline{\hspace{3cm}}

    \vspace{1.5cm}

    \begin{flushright}
        \underline{\hspace{6cm}}\\[0.2cm]
        \textbf{\cosupervisornametext}\\
        \cosupervisordesignationtext\\
        \cosupervisordepartmenttext\\
        \institutenameshorttext\\
        \institutelocationtext
    \end{flushright}
    \end{singlespace}
}

%% Alias
\let\makecosupervisorcertificate\makecoguidecertificate

%% ============================================================
%% CERTIFICATE FROM THE HOD
%% ============================================================

\newcommand{\makehodcertificate}{%
    \clearpage
    \thispagestyle{empty}
    \begin{singlespace}
    \begin{center}
        {\Large\bfseries CERTIFICATE FROM THE HEAD OF DEPARTMENT}\\[1cm]
    \end{center}

    \noindent This is to certify that the dissertation entitled \textbf{``\thesistitletext''} is the bonafide work of \textbf{\candidatenametext} in partial fulfilment of the requirements for the award of \textbf{\degreenametext\ (\degreebranchtext)} degree from \textbf{\universitynametext}, Kolkata.

    \vspace{0.5cm}

    \noindent This work has been carried out at the \departmentnametext, \institutenametext, \institutelocationtext\ under the guidance of \textbf{\supervisornametext}, \supervisordesignationtext.

    \vspace{0.5cm}

    \noindent I am satisfied that this dissertation represents independent and original work on the part of the candidate. The candidate has fulfilled all the requirements as per the university regulations.

    \vfill

    \noindent Place: \institutelocationtext \hfill \\[0.3cm]
    \noindent Date: \underline{\hspace{3cm}}

    \vspace{1.5cm}

    \begin{flushright}
        \underline{\hspace{6cm}}\\[0.2cm]
        \textbf{\hodnametext}\\
        \hoddesignationtext\\
        \departmentnametext\\
        \institutenameshorttext\\
        \institutelocationtext
    \end{flushright}
    \end{singlespace}
}

%% ============================================================
%% CERTIFICATE FROM DIRECTOR / HEAD OF INSTITUTION
%% ============================================================

\newcommand{\makedirectorcertificate}{%
    \clearpage
    \thispagestyle{empty}
    \begin{singlespace}
    \begin{center}
        {\Large\bfseries ENDORSEMENT BY THE HEAD OF THE INSTITUTION}\\[1cm]
    \end{center}

    \noindent This is to certify that the dissertation entitled \textbf{``\thesistitletext''} is the bonafide work of \textbf{\candidatenametext} in partial fulfilment of the requirements for the award of \textbf{\degreenametext\ (\degreebranchtext)} degree from \textbf{\universitynametext}, Kolkata.

    \vspace{0.5cm}

    \noindent This work has been carried out at \institutenametext, \institutelocationtext.

    \vspace{0.5cm}

    \noindent The candidate has fulfilled all the requirements as per the university regulations. I recommend this dissertation for evaluation by the examiners appointed by the university.

    \vfill

    \noindent Place: \institutelocationtext \hfill \\[0.3cm]
    \noindent Date: \underline{\hspace{3cm}}

    \vspace{1.5cm}

    \begin{flushright}
        \underline{\hspace{6cm}}\\[0.2cm]
        \textbf{\institutionheadnametext}\\
        \institutionheaddesignationtext\\
        \institutenameshorttext\\
        \institutelocationtext
    \end{flushright}
    \end{singlespace}
}

%% Aliases for institution head certificate
\let\makeprincipalcertificate\makedirectorcertificate
\let\makeinstitutionheadcertificate\makedirectorcertificate

%% ============================================================
%% DECLARATION BY CANDIDATE
%% ============================================================

\newcommand{\makedeclaration}{%
    \clearpage
    \thispagestyle{empty}
    \begin{singlespace}
    \begin{center}
        {\Large\bfseries DECLARATION BY THE CANDIDATE}\\[0.8cm]
    \end{center}

    \noindent I, \textbf{\candidatenametext}, hereby declare that the dissertation entitled \textbf{``\thesistitletext''} submitted by me for the award of \textbf{\degreenametext\ (\degreebranchtext)} degree to \textbf{\universitynametext}, Kolkata is my original work.

    \vspace{0.25cm}

    \noindent I declare that this work has been carried out by me at the \departmentnametext, \institutenametext, \institutelocationtext\ during the period of \studyperiodtext\ under the guidance of \textbf{\supervisornametext}, \supervisordesignationtext.

    \vspace{0.25cm}

    \noindent I further declare that:
    \begin{enumerate}[label=\arabic*.,itemsep=2pt,parsep=2pt]
        \item This dissertation or any part thereof has not been previously submitted to any university or institution for the award of any degree, diploma, or other similar title.

        \item The work presented in this dissertation is original and the results are based on my own research conducted during the prescribed period and wherever contributions of others are involved, every effort has been made to acknowledge them clearly with due references to the literature and acknowledgement of collaborative research and discussions.

        \item I have followed the ethical guidelines prescribed by the Institutional Ethics Committee (IEC) and have obtained necessary ethical clearance for this study.

        \item This bonafide work or a part of this work was not submitted by me or any others for any award, degree, or diploma to any other University, Board either in India or abroad.
    \end{enumerate}

    \vfill

    \noindent Place: \institutelocationtext \hfill \\[0.3cm]
    \noindent Date: \underline{\hspace{3cm}}

    \vspace{1cm}

    \begin{flushright}
        \underline{\hspace{5cm}}\\[0.2cm]
        \textbf{\candidatenametext}\\
        \candidatedesignationtext\\
        \departmentnametext\\
        \institutenameshorttext\\
        \institutelocationtext
    \end{flushright}
    \end{singlespace}
}

%% ============================================================
%% ACKNOWLEDGEMENTS ENVIRONMENT
%% ============================================================

\newenvironment{acknowledgements}{%
    \clearpage
    \thispagestyle{empty}
    \begin{center}
        {\Large\bfseries ACKNOWLEDGEMENTS}\\[1cm]
    \end{center}
}{%
    \clearpage
}

%% ============================================================
%% ABSTRACT ENVIRONMENT
%% ============================================================

\newenvironment{thesis_abstract}{%
    \clearpage
    \thispagestyle{empty}
    \begin{center}
        {\Large\bfseries ABSTRACT}\\[0.5cm]
    \end{center}

    \noindent\textbf{Title:} \thesistitletext\\[0.3cm]
}{%
    \clearpage
}

%% ============================================================
%% LIST OF ABBREVIATIONS ENVIRONMENT
%% ============================================================

\newenvironment{abbreviations}{%
    \clearpage
    \thispagestyle{empty}
    \begin{center}
        {\Large\bfseries LIST OF ABBREVIATIONS}\\[1cm]
    \end{center}
    \begin{longtable}{@{}l@{\hspace{2cm}}l@{}}
}{%
    \end{longtable}
    \clearpage
}

%% ============================================================
%% FRONT MATTER, MAIN MATTER, BACK MATTER COMMANDS
%% ============================================================

\newcommand{\frontmatter}{%
    \cleardoublepage
    \pagenumbering{gobble}
    \pagestyle{frontmatter}
}

\newcommand{\mainmatter}{%
    \cleardoublepage
    \pagenumbering{arabic}
    \setcounter{page}{1}
    \pagestyle{mainmatter}
    % Ensure chapter pages also use mainmatter style
    \assignpagestyle{\chapter}{mainmatter}
}

\newcommand{\backmatter}{%
    \cleardoublepage
    \pagestyle{bibliography}
    \gdef\currentchaptertitle{References}
}

\newcommand{\annexurematter}{%
    \cleardoublepage
    \setcounter{chapter}{0}
    \renewcommand{\thechapter}{\Roman{chapter}}
    \pagestyle{annexure}
    \gdef\currentchaptertitle{Annexures}
}

%% ============================================================
%% ANNEXURE CHAPTER COMMAND
%% ============================================================

\newcommand{\annexurechapter}[1]{%
    \refstepcounter{chapter}
    \chapter*{ANNEXURE \thechapter: #1}
    \addcontentsline{toc}{chapter}{Annexure \thechapter: #1}
    \gdef\currentchaptertitle{Annexure \thechapter: #1}
}

%% ============================================================
%% TABLE AND FIGURE NUMBERING
%% ============================================================

\numberwithin{table}{chapter}
\numberwithin{figure}{chapter}

%% ============================================================
%% PARAGRAPH FORMATTING
%% ============================================================

\setlength{\parindent}{0.5in}
\setlength{\parskip}{0pt}

%% ============================================================
%% BIBLIOGRAPHY SETUP
%% ============================================================

\renewcommand{\bibsection}{%
    \chapter*{\bibname}%
    \addcontentsline{toc}{chapter}{\bibname}%
    \gdef\currentchaptertitle{References}%
}

%% ============================================================
%% CUSTOM COMMANDS FOR MEDICAL/SCIENTIFIC WRITING
%% ============================================================

\newcommand{\pvalue}[1]{p~=~#1}
\newcommand{\pless}[1]{p~<~#1}
\newcommand{\pgreater}[1]{p~>~#1}
\newcommand{\ci}[2]{95\%~CI~[#1,~#2]}
\newcommand{\meansd}[2]{#1~$\pm$~#2}
\newcommand{\medianiqr}[2]{#1~(IQR:~#2)}
\newcommand{\spearmanrho}[1]{$\rho$~=~#1}
\newcommand{\pearsonr}[1]{r~=~#1}
\newcommand{\chisq}[1]{$\chi^2$~=~#1}
\newcommand{\oddsratio}[1]{OR~=~#1}
\newcommand{\relativerisk}[1]{RR~=~#1}
\newcommand{\hazardratio}[1]{HR~=~#1}
\newcommand{\samplesize}[1]{n~=~#1}

%% ============================================================
%% WATERMARK COMMANDS
%% ============================================================

%% Opacity guide: Higher value = MORE visible
%%   0.05-0.10 = very subtle | 0.15-0.25 = light but readable
%%   0.30-0.50 = clearly visible | 0.50+ = very prominent

%% Main command: \setupwatermark{text}{opacity}
\newcommand{\setupwatermark}[2]{%
    \SetWatermarkText{#1}%
    \edef\@watermarkgray{\fpeval{1-#2}}%
    \SetWatermarkColor[gray]{\@watermarkgray}%
}

%% Individual setters
\newcommand{\setwatermarktext}[1]{\SetWatermarkText{#1}}
\newcommand{\setwatermarkopacity}[1]{%
    \edef\@watermarkgray{\fpeval{1-#1}}%
    \SetWatermarkColor[gray]{\@watermarkgray}%
}
\newcommand{\setwatermarkscale}[1]{\SetWatermarkScale{#1}}
\newcommand{\setwatermarkangle}[1]{\SetWatermarkAngle{#1}}
\newcommand{\removewatermark}{\SetWatermarkText{}}

%% Presets
\newcommand{\draftwatermark}{%
    \SetWatermarkText{DRAFT}\SetWatermarkColor[gray]{0.85}%
    \SetWatermarkScale{1}\SetWatermarkAngle{45}}
\newcommand{\confidentialwatermark}{%
    \SetWatermarkText{CONFIDENTIAL}\SetWatermarkColor[gray]{0.80}%
    \SetWatermarkScale{0.8}\SetWatermarkAngle{45}}
\newcommand{\reviewwatermark}{%
    \SetWatermarkText{FOR REVIEW ONLY}\SetWatermarkColor[gray]{0.85}%
    \SetWatermarkScale{0.6}\SetWatermarkAngle{45}}
\newcommand{\examwatermark}{%
    \SetWatermarkText{FOR EXAMINATION}\SetWatermarkColor[gray]{0.88}%
    \SetWatermarkScale{0.6}\SetWatermarkAngle{45}}

%% ============================================================
%% END OF CLASS FILE
%% ============================================================

\endinput
