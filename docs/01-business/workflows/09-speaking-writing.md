# Speaking, Writing và giáo viên

Nghiệp vụ chốt ngày 2026-10-23 (D169–D174). Ngân hàng đề và duyệt đề đã triển khai ở F11 (D176), Speaking đọc to ở F12 (D177), key Gemini và Writing ở F13 (D178), Speaking nói mở ở F14 (D179), giáo viên chấm ở F15 (D180), hồ sơ CEFR và công cụ đánh giá AI ở F16 (D181). Hồ sơ CEFR đã bỏ và cấp đề đổi sang mức điểm TOEIC (D201).

## Vai trò

| Vai trò | Việc |
|---|---|
| Teacher (mới) | Soạn đề Speaking và Writing theo mức điểm TOEIC, gửi duyệt, sửa đề khi có lỗi; chấm bài học viên gửi (hàng chờ chung). Không soạn lesson, mock, bài nghe; không có lớp học |
| Content Manager | Duyệt đề do giáo viên gửi: xuất bản hoặc trả lại kèm góp ý; gỡ đề đã xuất bản. Không soạn hay sửa nội dung đề Speaking/Writing |
| Admin | Tạo và quản lý tài khoản giáo viên như các vai trò khác |
| Student | Chọn đề theo mức, làm bài, nhận điểm tự động, gửi giáo viên chấm (3 lượt/tuần) |

Không có lớp học, mã lớp, giao bài (assignment) hay buổi học trực tiếp. Mọi giáo viên dùng chung một hàng chờ bài.

## Ngân hàng đề

Mỗi đề có: loại, mức (Basic (TOEIC dưới 110), Intermediate (110–150), Advanced (trên 150); D201), chủ đề, tiêu đề, người soạn.

| Loại | Nội dung đề | Bài mẫu | Ý chính |
|---|---|---|---|
| Speaking – đọc to (`read_aloud`) | Câu hoặc đoạn ngắn để đọc; audio mẫu (giáo viên tải lên hoặc bấm tạo bằng giọng máy Piper Anh-Anh, D123, D177) | Không cần (câu mẫu chính là đáp án) | Không |
| Speaking – nói mở (`open_speaking`) | Yêu cầu (mô tả tranh, trả lời câu hỏi, nêu ý kiến), có thể kèm hình; thời gian nói tối đa | Bắt buộc (một bài nói mẫu dạng chữ) | Không bắt buộc |
| Writing (`writing`) | Loại bài (câu, email, đoạn văn, bài luận ngắn), đề bài, có thể kèm hình; số từ tối thiểu và tối đa | Bắt buộc | Không bắt buộc |

- Bài mẫu là mốc tham khảo cho AI và giáo viên khi chấm, không phải đáp án so từng chữ: ý khác nhưng đúng đề không bị trừ.
- Ý chính là danh sách các ý đề yêu cầu (ví dụ "nêu lý do xin nghỉ, đề xuất ngày bù, lời cảm ơn"); khi có, AI và giáo viên chấm mức hoàn thành yêu cầu đề theo danh sách này.
- Bài mẫu và ý chính chỉ dùng làm đầu vào cho AI chấm và để giáo viên tham khảo; học viên không bao giờ thấy, kể cả sau khi nộp (D185).

## Dạng câu ETS (D195)

Mỗi đề có dạng câu ETS và mức điểm TOEIC. Giáo viên soạn Speaking theo Part 1–5 (Part 1 đọc to, 2 tả tranh, 3 trả lời câu hỏi, 4 trả lời theo thông tin, 5 nêu quan điểm); đề tạo trong Part nào thì mang sẵn dạng câu của Part đó (D209).

| Kỹ năng | Dạng | Nội dung đề | Thời gian luyện mặc định |
|---|---|---|---|
| Speaking | Read a text aloud | đoạn văn, audio mẫu | chuẩn bị 45 giây, đọc 45 giây |
| Speaking | Describe a picture | hình (bắt buộc), yêu cầu, bài mẫu | 45 / 30 giây |
| Speaking | Respond to questions | bối cảnh + đúng 3 câu hỏi (chữ, bài mẫu, audio tuỳ chọn) | mỗi câu chuẩn bị 3 giây, trả lời 15 / 15 / 30 giây |
| Speaking | Respond using information provided | bảng thông tin + đúng 3 câu hỏi | đọc 45 giây; 3 giây chuẩn bị; 15 / 15 / 30 giây; câu 3 phát hai lần |
| Speaking | Express an opinion | câu hỏi, bài mẫu | 45 / 60 giây |
| Writing | Write a sentence based on a picture | hình + 2 từ bắt buộc, một câu | 96 giây (8 phút cho 5 câu như đề thật) |
| Writing | Respond to a written request | email đề bài + yêu cầu | 10 phút |
| Writing | Write an opinion essay | câu hỏi | 30 phút, khuyến nghị từ 300 từ |

- Audio câu hỏi: giáo viên tải lên hoặc tạo bằng giọng máy Piper.
- Giọng máy có ba tốc độ Slow / Normal / Natural, giáo viên chọn trước khi tạo (mặc định Normal). Khi luyện không đếm giờ, học viên đổi tốc độ phát 0.75× / 1× / 1.25× cho audio mẫu và audio câu hỏi (D200).
- Dạng 3 câu: học viên ghi âm 3 câu trả lời; mỗi câu là một bài nộp con có chung mã bộ (`setId`), chấm như đề nói mở (Whisper + Gemini) với chính câu hỏi và bài mẫu của câu đó; gửi giáo viên chấm tính theo từng bài nộp.
- Khi luyện, mặc định đếm giờ theo ETS: ghi âm tự bắt đầu sau thời gian chuẩn bị và tự dừng; Writing khoá ô viết khi hết giờ. "Practice without timer" bỏ đếm giờ (vẫn theo giới hạn ghi âm và số từ của đề). Giới hạn ghi âm đọc to nâng lên 45 giây.
- Đề cũ: đọc to, email, bài luận được xếp dạng tự động; đề khác giáo viên chọn dạng khi sửa. Gửi duyệt cần có dạng câu. Học viên lọc đề theo dạng câu và mức.
- Chấm theo rubric ETS chưa áp dụng (bàn ở feature chấm).
- Giao diện: chọn dạng câu thì đề tự đặt sẵn giới hạn hợp lý (câu tả tranh 1–40 từ, bài luận từ 300 từ; thời gian nói ít nhất bằng thời gian trả lời dài nhất của dạng). Có giờ thì bản ghi dài tối đa bằng thời gian ETS và không quá thời gian nói của đề; bấm Start mới bắt đầu tính giờ, được bỏ qua thời gian chuẩn bị/đọc; bài đơn có giờ được thử lại một lần trước khi nộp; trong bộ 3 câu, mỗi câu gửi ngay khi dừng ghi (lỗi thì có "Send again"). Writing hết giờ thì khoá ô viết, vẫn nộp được nếu đủ số từ. Lịch sử đề dạng bộ hiện mỗi lượt một dòng với điểm trung bình 3 câu.

## Bài thi Speaking/Writing (D196)

- Một đề thi có tên và hai phần. Speaking 11 câu: 1–2 đọc to, 3–4 mô tả tranh, 5–7 trả lời câu hỏi theo một bối cảnh, 8–10 trả lời theo bảng thông tin, 11 nêu quan điểm. Writing 8 câu: 1–5 viết câu tả tranh với 2 từ, 6–7 trả lời email, 8 bài luận.
- Giáo viên soạn trực tiếp trong đề, Content Manager duyệt như mọi nội dung (D191). Gửi duyệt khi đủ câu; câu 5–10 cần audio câu hỏi (tải lên hoặc giọng máy), câu 3–4 và Writing 1–5 cần hình, mỗi câu tả tranh có đúng 2 từ, mỗi email có nội dung và yêu cầu.
- Học viên thi riêng từng phần, mỗi phần một lượt. Speaking: kiểm tra micro, rồi từng câu theo đúng thứ tự và thời gian ETS, không dừng, không quay lại; mỗi câu ghi âm xong là gửi và bị khoá (micro lỗi thì câu được đóng không có bản ghi). Writing: câu 1–5 chung 8 phút, được Back/Next; câu 6, 7 mỗi câu 10 phút; câu 8 30 phút; sang nhóm sau thì nhóm trước bị khoá; hết giờ tự chuyển. Server tự nộp khi quá giới hạn an toàn (Speaking 30 phút, Writing 70 phút).
- Bắt đầu lại hoặc rời trang giữa chừng thì lượt dở bị huỷ cùng bản ghi. Làm lại không giới hạn, không XP; nộp bài tính một ngày học.
- Chưa chấm: kết quả hiện "Not scored yet" kèm bản ghi và câu trả lời từng câu. Bản ghi giữ 180 ngày như bản ghi luyện tập.
- Giao diện: câu 8–10 không hiện chữ câu hỏi (chỉ bảng thông tin và audio, như đề thật); câu 5–7 và 11 hiện chữ. Speaking không có nút dừng, mỗi câu ghi đủ thời gian trả lời. Kiểm tra micro trước khi bắt đầu tính giờ; Writing hỏi xác nhận trước khi bắt đầu.

## Chấm bài thi Speaking/Writing (D198)

- Nộp bài thi là AI tự chấm từng câu bằng key Gemini của học viên. Speaking câu 1–2: Whisper cho điểm phát âm 0–3 (từ độ chính xác) và ngữ điệu/trọng âm 0–3 (ước lượng từ tốc độ và chỗ ngừng, gần đúng), điểm câu là trung bình hai điểm. Câu 3–11: Whisper chuyển chữ, Gemini chấm theo hướng dẫn chấm của sổ tay ETS (câu 3–10 thang 0–3, câu 11 thang 0–5; câu tả tranh chấm theo lời nói vì Gemini không xem hình). Writing: câu 1–5 thang 0–3, câu 6–7 thang 0–4, câu 8 thang 0–5. Câu không có bản ghi, không nghe được lời hoặc bỏ trống được 0.
- Điểm thô Speaking tối đa 35, Writing tối đa 28; quy ra thang 0–200 bước 10 bằng bảng quy đổi (mặc định tuyến tính, Admin sửa được), ghi là ước tính. Kết quả hiện khoảng năng lực ETS; Speaking thêm mức phát âm và ngữ điệu (Low/Medium/High).
- Không có key: bài chưa chấm, học viên gửi giáo viên hoặc thêm key rồi chấm lại. Gemini lỗi: báo lý do, cho chấm lại.
- Gửi giáo viên: cả phần (Speaking hoặc Writing) là 1 lượt trong 3 lượt/tuần, cùng hàng chờ, khoá 2 giờ, hết hạn 48 giờ. Giáo viên xác nhận điểm AI, sửa điểm từng câu hoặc chấm từ đầu (khi không có điểm AI), nhận xét bắt buộc khi sửa hoặc chấm từ đầu. Điểm giáo viên thay điểm AI.
- Có điểm thì học viên nhận thông báo; thẻ mục tiêu S&W hiện điểm Speaking/Writing của lượt chấm gần nhất. Đề luyện giữ cách chấm cũ.

## Duyệt và xuất bản đề

1. Giáo viên soạn nháp (chỉ người soạn thấy và sửa), rồi bấm "Gửi duyệt".
2. Content Manager xem đề trong danh sách chờ duyệt:
   - Duyệt: đề được xuất bản, học viên thấy.
   - Trả lại: đề quay về giáo viên kèm góp ý bắt buộc.
3. Đề đã xuất bản bị lỗi: giáo viên sửa thành bản mới và gửi duyệt lại; bản đang xuất bản vẫn dùng cho đến khi bản mới được duyệt. Mọi sửa đổi, kể cả lỗi chính tả, đều qua duyệt.
4. Lỗi nặng: Content Manager gỡ đề ngay; đề gỡ không hiện cho học viên, bài đã nộp vẫn xem được.
5. Mỗi bài nộp lưu bản chụp đề lúc làm (nội dung, bài mẫu, ý chính, cấp), nên sửa hay gỡ đề không đổi bài đã chấm.
6. Chỉ người soạn sửa đề của mình; Content Manager không sửa nội dung đề.
7. Xóa đề (D214): giáo viên xóa đề nháp chưa từng xuất bản và không đang chờ duyệt. Đề đã từng xuất bản chỉ Content Manager xóa, khi đề đã gỡ và không còn bài làm nào của học viên (học viên tự xóa được lịch sử, trừ bài đã gửi giáo viên); còn bài làm thì từ chối và báo số bài còn lại.

Trạng thái một bản đề: `DRAFT` → `PENDING_REVIEW` → `PUBLISHED` hoặc `RETURNED` (về lại `DRAFT` khi giáo viên sửa). Gỡ đề: `UNPUBLISHED`.

## Học viên làm bài

- Practice có thêm hai mục: Speaking và Writing. Danh sách đề có tìm kiếm, lọc theo mức, chủ đề, loại, trạng thái (chưa làm, đã làm, điểm cao nhất) và phân trang.
- Mặc định mở ở mức Intermediate; nếu mức đó chưa có đề thì mở mức đầu tiên có đề, không bao giờ mở một danh sách trống khi đã có đề (D183, D201).
- Speaking – đọc to: nghe mẫu, ghi âm trên trình duyệt (tối đa 45 giây, D195), nộp. Màn hình luyện: "Read sample" phát từ câu đầu đến hết câu cuối theo mốc của giáo viên và tô sáng câu đang đọc (D215), "Bilingual" hiện bản dịch tiếng Việt từng câu do giáo viên soạn; lịch sử lượt làm ở trang riêng (D212).
- Speaking – nói mở: đọc yêu cầu, ghi âm (tối đa theo đề, không quá 2 phút), nộp.
- Writing: viết trong ô soạn có đếm từ; nộp khi đủ số từ tối thiểu và không quá số từ tối đa.
- Trang đề có hai tab: làm bài (đề, chỗ làm, kết quả lần vừa nộp) và lịch sử (danh sách các lần nộp và kết quả từng lần) (D185).
- Sau khi nộp, bài ở trạng thái "đang chấm"; có kết quả thì hiện ngay và có thông báo. Học viên làm lại đề bao nhiêu lần cũng được; mỗi đề có lịch sử các lần nộp, điểm AI và điểm giáo viên (nếu có).
- Nộp bài Speaking/Writing tính là một ngày học của streak (D154).

## Chấm tự động

### Speaking – đọc to (Whisper, miễn phí)
- speech-service nhận dạng bằng Whisper, lấy từng từ kèm độ tin cậy, căn chỉnh chuỗi từ nghe được với câu mẫu.
- Mỗi từ của câu mẫu có trạng thái: đúng, phát âm sai (khớp nhưng độ tin cậy thấp), thiếu; từ thừa được liệt kê riêng.
- Điểm theo thang 0–10 như Speechocean762: Accuracy, Completeness, Fluency (tốc độ nói, khoảng ngừng) và Total; công thức và ngưỡng ở D177 (F16 đối chiếu lại với Speechocean762).
- Giới hạn ghi rõ cho học viên: Whisper có thể "tự sửa" từ phát âm sai thành từ đúng, nên lỗi phát âm nhỏ có thể bị bỏ sót.
- Có key Gemini: sau khi có điểm, Gemini viết nhận xét, "What went well", "To score higher" và các từ nên luyện từ đoạn văn, chữ Whisper nghe được, trạng thái từng từ, tốc độ và khoảng ngừng; không đổi điểm, không nghe giọng. Gemini lỗi thì vẫn giữ điểm (D202).
- Sau khi nộp, học viên sang màn hình kết quả riêng: màn hình chờ trong lúc chấm, rồi kết quả, chữ máy nghe được ("What we heard") và nhận xét AI có bản tiếng Việt (D203).

### Speaking – nói mở và Writing (Gemini bằng key của học viên)
- Speaking nói mở: Whisper chuyển giọng nói thành chữ; Gemini chấm phần chữ; Fluency và Pronunciation lấy từ số liệu Whisper (tốc độ, khoảng ngừng, độ tin cậy từng từ). Gemini không nghe giọng, nên phát âm và ngữ điệu chỉ đánh giá gần đúng.
- Gemini nhận: đề, mức điểm TOEIC của đề, bài mẫu, ý chính (nếu có), rubric từng mức và bài của học viên; trả JSON đúng khuôn; temperature 1.0 theo khuyến nghị của Google cho Gemini 3 (D178); JSON sai khuôn thì thử lại một lần.
- Writing: điểm 1–5 theo sáu tiêu chí của ELLIPSE (cohesion, syntax, vocabulary, phraseology, grammar, conventions), cộng tiêu chí hoàn thành yêu cầu đề (theo bài mẫu và ý chính). Giao diện gộp thành Từ vựng (vocabulary, phraseology), Ngữ pháp (syntax, grammar, conventions), Mạch lạc (cohesion) và Hoàn thành đề; điểm tổng là trung bình 4 nhóm (D178).
- Speaking nói mở: điểm 1–5 cho Hoàn thành đề, Từ vựng, Ngữ pháp, Mạch lạc; Fluency/Pronunciation 0–10 từ Whisper; điểm tổng 0–10 = 60% Gemini (quy về thang 10) + 20% Fluency + 20% Pronunciation (D179).
- Nhận xét: một đoạn nhận xét chung; danh sách lỗi (đoạn sai, gợi ý sửa, giải thích ngắn) tô ngay trong bài; có thể kèm bản viết lại tốt hơn.
- Gemini nhận xét theo kỳ vọng của cấp đề (bài A2 không bị đòi cấu trúc C1), nhưng điểm vẫn theo thang cố định để so được với dữ liệu chuyên gia.
- Điểm theo rubric ETS cho bài luyện (D199): đề có dạng câu ETS hiện thêm "TOEIC score estimate" — nói mở 0–3 (nêu quan điểm 0–5) do Gemini chấm theo hướng dẫn chấm ETS trong cùng lần gọi; đọc to 0–3 là trung bình phát âm và ngữ điệu quy từ Accuracy, Fluency như câu 1–2 bài thi. Chỉ để tham khảo, không thay điểm 0–10. Writing luyện tập cũng vậy: câu tả tranh 0–3, trả lời email 0–4, bài luận 0–5, Gemini chấm trong cùng lần gọi; không thay điểm 1–5.
- Rubric cố định. Học viên tự chọn model Gemini (trong danh sách Flash ổn định) và mức suy nghĩ cho key của mình; mỗi kết quả ghi model đã chấm (D184).

### Key Gemini của học viên
- Học viên tự tạo API key Gemini bằng tài khoản Google của mình (Google AI Studio) và dán vào trang Profile; có trang hướng dẫn từng bước.
- Máy chủ gọi Gemini bằng key đó (không gọi từ trình duyệt, để điểm không bị sửa và rubric không lộ). Key được kiểm tra bằng một lệnh gọi nhỏ khi lưu, lưu mã hóa, không bao giờ trả về trình duyệt (chỉ hiện 4 ký tự cuối), không ghi vào log; học viên xóa được bất cứ lúc nào.
- Khi dán key, app ghi rõ: với gói miễn phí, Google có thể dùng dữ liệu gửi lên để cải thiện sản phẩm; lượt dùng thuộc hạn mức của tài khoản Google đó.
- Key hết hạn mức hoặc Gemini lỗi: bài chờ trong hàng đợi và thử lại (D168); vẫn lỗi thì bài ở trạng thái "chưa chấm được" kèm lý do (ví dụ "Gemini của bạn đã hết lượt hôm nay") và học viên có thể gửi giáo viên chấm.
- Không có key: đề đọc to vẫn chấm tự động, không có nhận xét; đề nói mở hiện phần chữ Whisper nghe được kèm Fluency và Pronunciation, không có điểm tổng (D179); bài Writing chỉ được lưu. Cả hai có nút "Gửi giáo viên chấm".
- Hệ thống không tự trả tiền AI cho học viên; không có key chung của hệ thống cho học viên.

## Giáo viên chấm

- Mỗi học viên có 3 lượt giáo viên chấm mỗi tuần, tính chung cho Speaking và Writing; tuần từ thứ 2 đến chủ nhật theo giờ Việt Nam; lượt không dùng không cộng dồn. Trang làm bài hiện "Còn n/3 lượt tuần này".
- Học viên chọn "Gửi giáo viên chấm" cho một bài đã nộp (mỗi bài gửi một lần; bài bị trả lại được gửi lại). Gửi là giữ một chỗ trong 3 lượt của tuần; chỗ chỉ mất hẳn khi giáo viên chấm xong, bài bị trả thì hoàn chỗ (D180). Bài còn chờ và chưa giáo viên nào nhận thì học viên rút lại được, lượt được hoàn (D182).
- Hàng chờ chung cho mọi giáo viên, cũ trước; giáo viên nhận một bài thì bài bị khóa cho người đó (2 giờ); hết giờ chưa chấm thì bài trở lại hàng chờ.
- Bài chờ quá 48 giờ mà chưa giáo viên nào chấm: rút khỏi hàng chờ, trả lại lượt và báo học viên.
- Giáo viên thấy bản chụp đề, bài mẫu, ý chính, bài của học viên (nghe bản ghi hoặc đọc bài) và điểm AI nếu có. Việc có thể làm:
  - Xác nhận điểm AI.
  - Sửa điểm từng tiêu chí và ghi nhận xét (Writing chấm theo 4 nhóm hiển thị, D180).
  - Chấm từ đầu khi chưa có điểm AI.
- Nhận xét của giáo viên là bắt buộc khi sửa điểm hoặc chấm từ đầu.
- Kết quả: nhãn "AI score" đổi thành "Reviewed by teacher"; điểm giáo viên thay điểm AI trong hồ sơ năng lực; học viên nhận thông báo.
- Mỗi lần chấm được ghi lại (giáo viên, bài, loại việc, điểm trước và sau, lúc nhận, lúc xong) để thống kê; chưa tính lương (TBD).

## Luồng bất đồng bộ và thông báo

Nộp bài → lưu bài và ghi outbox trong cùng giao dịch → RabbitMQ → worker AI (speech-service cho Whisper; worker Gemini cho nói mở và Writing) → kết quả có `messageId`, chống trùng, thử lại và hàng đợi chết theo D168 → lưu điểm → event sang progress (streak) → thông báo cho học viên. Worker AI chạy được nhiều bản song song để tăng tải.

Thông báo mới cho học viên: bài đã được AI chấm, AI chưa chấm được (kèm lý do), giáo viên đã chấm, lượt giáo viên được trả lại. Cho giáo viên: đề bị trả lại kèm góp ý, đề đã được xuất bản. Cho Content Manager: có đề mới chờ duyệt.

## Đánh giá độ chính xác AI

- Speaking đọc to: 100–200 mẫu Speechocean762; so Accuracy, Fluency, Completeness, Total với điểm chuyên gia; Pearson, Spearman, MAE.
- Writing: 100–200 bài ELLIPSE; so sáu tiêu chí và điểm tổng; Pearson, Spearman, MAE, QWK.
- Chạy bằng key của người phát triển, cùng model và prompt với hệ thống; kết quả ghi vào tài liệu đánh giá.

## Ngoài phạm vi

Lớp học, mã lớp, giao bài có hạn nộp, buổi học trực tiếp; tính lương giáo viên (dữ liệu đã được ghi lại, cách tính để sau); placement CEFR mới; hồ sơ năng lực CEFR (bỏ ở D201); ôn từ vựng lặp lại ngắt quãng (SM-2); key AI chung do hệ thống trả tiền cho học viên.
